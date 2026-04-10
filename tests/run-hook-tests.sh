#!/usr/bin/env bash
# Automated hook test runner for claude-cortex
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES="$REPO_ROOT/tests/fixtures"
PASS=0
FAIL=0

export CLAUDE_PLUGIN_ROOT="$REPO_ROOT"
export CLAUDE_PLUGIN_DATA="/tmp/cortex-hook-test-$$"
mkdir -p "$CLAUDE_PLUGIN_DATA/session-cache"

# Create a self-contained temp vault for testing
TEST_VAULT="/tmp/cortex-test-vault-$$"
mkdir -p "$TEST_VAULT"
echo "# Vault Memory" > "$TEST_VAULT/memory.md"
echo "" > "$TEST_VAULT/_changelog.txt"
cat > "$TEST_VAULT/personality.md" << 'PEOF'
---
identity:
  name: "Test User"
  role: "Developer"
mental_model:
  bucket_term: "Projects"
  buckets:
    - name: "Alpha"
      type: "Active Project"
    - name: "Beta"
      type: "Ongoing Support"
progressive_features:
  active:
    - core_capture
  dormant:
    - name: weekly_review
      activation_signal: "changelog_lines >= 50"
---

# Test Personality

This is a test personality file.
PEOF

# Config pointing at our test vault
TEST_CONFIG="/tmp/cortex-test-config-$$.json"
printf '{"vault_path": "%s", "schema_version": 1}' "$TEST_VAULT" > "$TEST_CONFIG"

# Write vault path cache (points at our temp vault)
echo "$TEST_VAULT" > "$CLAUDE_PLUGIN_DATA/session-cache/vault-path.txt"

# Patch fixture paths to use the temp vault
for f in "$FIXTURES"/*.json; do
    sed "s|/home/testuser/vault|$TEST_VAULT|g" "$f" > "$CLAUDE_PLUGIN_DATA/$(basename "$f")"
done

# --- Test helpers ---

run_test() {
    local name="$1"
    local hook="$2"
    local fixture="$3"
    local pattern="$4"

    output=$(cat "$CLAUDE_PLUGIN_DATA/$fixture" | bash "$REPO_ROOT/hooks/$hook" 2>/dev/null || echo "HOOK_ERROR")

    if echo "$output" | grep -q "$pattern"; then
        echo "  PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $name"
        echo "    Expected pattern: $pattern"
        echo "    Got: $(echo "$output" | head -3)"
        FAIL=$((FAIL + 1))
    fi
}

run_test_empty() {
    local name="$1"
    local hook="$2"
    local fixture="$3"

    output=$(cat "$CLAUDE_PLUGIN_DATA/$fixture" | bash "$REPO_ROOT/hooks/$hook" 2>/dev/null || echo "HOOK_ERROR")

    if [ -z "$output" ] || [ "$output" = "{}" ]; then
        echo "  PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $name (expected empty output)"
        echo "    Got: $(echo "$output" | head -3)"
        FAIL=$((FAIL + 1))
    fi
}

run_boot_test() {
    local name="$1"
    local extra_args="$2"
    local check_expr="$3"

    local output
    output=$(python3 "$REPO_ROOT/hooks/lib/boot-context.py" \
        --config "$TEST_CONFIG" --cwd "/tmp" $extra_args 2>/dev/null) || {
        if [[ "$check_expr" == "EXIT_NONZERO" ]]; then
            echo "  PASS: $name"
            PASS=$((PASS + 1))
            return
        fi
        echo "  FAIL: $name (python exited non-zero)"
        FAIL=$((FAIL + 1))
        return
    }

    if [[ "$check_expr" == "EXIT_NONZERO" ]]; then
        echo "  FAIL: $name (expected non-zero exit but got 0)"
        FAIL=$((FAIL + 1))
        return
    fi

    local result
    result=$(python3 -c "
import json, sys
data = json.loads(sys.stdin.read())
print('true' if ($check_expr) else 'false')
" <<< "$output" 2>/dev/null)

    if [[ "$result" == "true" ]]; then
        echo "  PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: $name"
        echo "    Check: $check_expr"
        echo "    Output keys: $(python3 -c "import json,sys; print(list(json.loads(sys.stdin.read()).keys()))" <<< "$output" 2>/dev/null)"
        FAIL=$((FAIL + 1))
    fi
}

# --- Tests ---

echo "=== Claude Cortex Hook Tests ==="
echo

echo "session-start:"
run_test "loads vault context" "session-start" "session-start-input.json" "cortex-session"

# Restore test vault path — session-start overwrites the cache with the real vault
echo "$TEST_VAULT" > "$CLAUDE_PLUGIN_DATA/session-cache/vault-path.txt"

echo
echo "post-tool-use:"
run_test "logs vault write" "post-tool-use" "post-tool-use-vault-write.json" "cortex-changelog"
run_test_empty "skips non-vault" "post-tool-use" "post-tool-use-non-vault.json"

echo
echo "user-prompt-submit:"
run_test "detects meeting" "user-prompt-submit" "user-prompt-submit-meeting.json" "cortex-process-meeting"
run_test "detects status query" "user-prompt-submit" "user-prompt-submit-status.json" "cortex-check-status"
run_test_empty "no match returns empty" "user-prompt-submit" "user-prompt-submit-no-match.json"

echo
echo "stop:"
# Create fake pending file for the stop test
mkdir -p "$CLAUDE_PLUGIN_DATA/session-cache"
echo '[{"section": "test", "content": "## Hook Test\\nTest flush."}]' > "$CLAUDE_PLUGIN_DATA/session-cache/pending-memory.json"
run_test "flushes pending" "stop" "stop-with-pending.json" "cortex-memory"

run_test_empty "bails on active" "stop" "stop-empty.json"

echo
echo "boot-context.py:"

# Test 1: L1 — no registry match
run_boot_test "L1 — no registry match" "" \
    "data['activation_level'] == 1 and data['project'] is None and 'Test User' in data['personality'] and data['memory'] != ''"

# Test 5: Missing files graceful
SAVED_MEMORY="$(cat "$TEST_VAULT/memory.md")"
SAVED_CHANGELOG="$(cat "$TEST_VAULT/_changelog.txt")"
rm -f "$TEST_VAULT/memory.md" "$TEST_VAULT/_changelog.txt"

run_boot_test "missing files graceful" "" \
    "data['memory'] == '' and data['recent_activity'] == '' and data['personality'] != ''"

echo "$SAVED_MEMORY" > "$TEST_VAULT/memory.md"
echo "$SAVED_CHANGELOG" > "$TEST_VAULT/_changelog.txt"

# Test 6: No config — non-zero exit
SAVED_CONFIG="$TEST_CONFIG"
TEST_CONFIG="/tmp/cortex-nonexistent-config-$$.json"
run_boot_test "no config — non-zero exit" "" "EXIT_NONZERO"
TEST_CONFIG="$SAVED_CONFIG"

# Test 3: L2 — cwd inside vault
run_boot_test "L2 — cwd inside vault" "--cwd $TEST_VAULT" \
    "data['activation_level'] == 2 and data['project'] is None"

# Test 2: L3 — cwd matches registered repo (needs registry + repo dir)
TEST_REPO="/tmp/cortex-test-repo-$$"
mkdir -p "$TEST_REPO"
mkdir -p "$TEST_VAULT/.claude/cortex"
mkdir -p "$TEST_VAULT/Work/TestClient/Test Project"

# Create a minimal project hub
cat > "$TEST_VAULT/Work/TestClient/Test Project/Test Project — Project Context.md" << 'HUBEOF'
---
type: project-context
project: "Test Project"
client: "TestClient"
status: "In Progress"
health: "on-track"
---

# Test Project — Project Context

## Stage Tracker
| Stage | Status | Notes |
|-------|--------|-------|
| Discovery & Brief | Complete | Done |
| Design / Wireframes | Complete | Done |
| Core Build | In Progress | Active |
| QA & Testing | Not Started | |

## Open Questions & Blockers
| # | Question / Blocker | Type | Owner | Status |
|---|-------------------|------|-------|--------|
| 1 | Waiting on API keys | Dependency | Client | Open |
| 2 | Color palette finalized? | Question | Design | Open |
| 3 | Old hosting resolved | Internal | Dev | Resolved |
HUBEOF

# Create project Changelog.md
cat > "$TEST_VAULT/Work/TestClient/Test Project/Changelog.md" << 'CEOF'
[2026-04-01] Decided to use Next.js for frontend
[2026-04-03] Switched from REST to GraphQL
[2026-04-05] Approved mobile-first approach
[2026-04-07] Deferred dark mode to v2
[2026-04-09] Locked header layout
[2026-04-10] Added search component
CEOF

# Create registry pointing test repo at this project
cat > "$TEST_VAULT/.claude/cortex/registry.json" << REOF
{
  "schema_version": 1,
  "projects": [
    {
      "id": "test-project",
      "vault_path": "Work/TestClient/Test Project",
      "context_file": "Test Project — Project Context.md",
      "repo_paths": ["$TEST_REPO"]
    }
  ]
}
REOF

run_boot_test "L3 — cwd matches registered repo" "--cwd $TEST_REPO" \
    "data['activation_level'] == 3 and data['project'] is not None and data['project']['id'] == 'test-project'"

echo
echo "=== Results: $PASS passed, $FAIL failed ==="

# Cleanup — only temp directories, never touches a real vault
rm -rf "$CLAUDE_PLUGIN_DATA"
rm -rf "$TEST_VAULT"
rm -f "$TEST_CONFIG"
rm -rf "$TEST_REPO"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1

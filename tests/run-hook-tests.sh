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
CORTEX_BOOT_CONFIG="$TEST_CONFIG" run_test "loads vault context" "session-start" "session-start-input.json" "cortex-session"

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
# W2.9 — transcript detection: a Granola-style **Name:** paste (no timestamps)
# routes to meeting at medium confidence (skill confirms file vs context).
run_test "Granola transcript routes to meeting" "user-prompt-submit" "user-prompt-submit-transcript-granola.json" "cortex-process-meeting"
run_test "Granola transcript is medium confidence (no timestamps)" "user-prompt-submit" "user-prompt-submit-transcript-granola.json" "confidence: medium"
# W2.9 — a bibliography/citation paste (Author:/Title:/DOI:) shares the "Key:"
# shape but must NOT hard-route to meeting filing.
run_test_empty "bibliography paste does NOT route to meeting" "user-prompt-submit" "user-prompt-submit-bibliography.json"
# W3.5 — broadened status phrasing: "on track" routes to cortex-check-status.
run_test "status phrasing 'on track' routes to check-status" "user-prompt-submit" "user-prompt-submit-on-track.json" "cortex-check-status"
# W3.4 — "we got the <X>" routes to cortex-update-context at medium confidence
# (documented blocker-resolved capture, previously unimplemented).
run_test "'we got the X' routes to update-context" "user-prompt-submit" "user-prompt-submit-we-got.json" "cortex-update-context"
run_test "'we got the X' is medium confidence" "user-prompt-submit" "user-prompt-submit-we-got.json" "confidence: medium"
# W3.4 — curly apostrophe (U+2019) normalization: "that’s resolved" matches the
# same straight-apostrophe pattern as "that's resolved".
run_test "curly-apostrophe 'that’s resolved' routes to update-context" "user-prompt-submit" "user-prompt-submit-curly-resolved.json" "cortex-update-context"
# W3.2 — bare "reusable" no longer over-fires the knowledge skill without an anchor.
echo '{"session_id":"t","hook_event_name":"UserPromptSubmit","user_prompt":"I built a reusable component for the navbar"}' > "$CLAUDE_PLUGIN_DATA/ups-bare-reusable.json"
run_test_empty "bare 'reusable' does NOT fire knowledge skill" "user-prompt-submit" "ups-bare-reusable.json"
# W3.3 — teaching-moment phrase writes a pending-signals.json producer entry.
echo '{"session_id":"sigtest-ns","hook_event_name":"UserPromptSubmit","user_prompt":"can you explain how the auth flow works?"}' > "$CLAUDE_PLUGIN_DATA/ups-teaching.json"
cat "$CLAUDE_PLUGIN_DATA/ups-teaching.json" | bash "$REPO_ROOT/hooks/user-prompt-submit" >/dev/null 2>&1 || true
if [[ -s "$CLAUDE_PLUGIN_DATA/session-cache/ns/sigtest-ns/pending-signals.json" ]]; then
    echo "  PASS: teaching moment writes namespaced pending-signals.json (W3.3)"
    PASS=$((PASS + 1))
else
    echo "  FAIL: teaching moment did not write pending-signals.json"
    FAIL=$((FAIL + 1))
fi

echo
echo "stop:"
# Create fake pending file for the stop test
mkdir -p "$CLAUDE_PLUGIN_DATA/session-cache"
echo '[{"section": "test", "content": "## Hook Test\\nTest flush."}]' > "$CLAUDE_PLUGIN_DATA/session-cache/pending-memory.json"
run_test "flushes pending" "stop" "stop-with-pending.json" "cortex-memory"

run_test_empty "bails on active" "stop" "stop-empty.json"

# W3.6 — namespaced session cache: post-tool-use and stop in the SAME session
# (same session_id) share a per-session namespace dir under session-cache/ns/.
# A different session_id must NOT see the first session's batch.
echo
echo "stop/post-tool-use namespacing + batched summary (W3.2/W3.6):"
NS_SID="nstest-$$"
NS_PATH="$CLAUDE_PLUGIN_DATA/session-cache/ns/$NS_SID"
mkdir -p "$NS_PATH"
echo "$TEST_VAULT" > "$NS_PATH/vault-path.txt"

# Two vault writes in one turn (post-tool-use), tagged with the same session_id.
for n in 1 2; do
  echo "{\"session_id\":\"$NS_SID\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TEST_VAULT/NSNote$n.md\"}}" \
    | bash "$REPO_ROOT/hooks/post-tool-use" >/dev/null 2>&1 || true
done

# The per-turn capture log must live under THIS session's namespace.
if [[ -s "$NS_PATH/turn-captures.log" ]]; then
    echo "  PASS: post-tool-use writes namespaced turn-captures.log"
    PASS=$((PASS + 1))
else
    echo "  FAIL: namespaced turn-captures.log missing"
    FAIL=$((FAIL + 1))
fi

# A concurrent session (different session_id) writes into its OWN namespace and
# must not append to the first session's capture log.
OTHER_SID="other-$$"
OTHER_PATH="$CLAUDE_PLUGIN_DATA/session-cache/ns/$OTHER_SID"
mkdir -p "$OTHER_PATH"
echo "$TEST_VAULT" > "$OTHER_PATH/vault-path.txt"
echo "{\"session_id\":\"$OTHER_SID\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$TEST_VAULT/OtherNote.md\"}}" \
    | bash "$REPO_ROOT/hooks/post-tool-use" >/dev/null 2>&1 || true
# First session's log still has exactly 2 lines (untouched by the other session).
ns1_lines="$(grep -c '' "$NS_PATH/turn-captures.log" 2>/dev/null | tr -dc '0-9' || true)"
other_lines="$(grep -c '' "$OTHER_PATH/turn-captures.log" 2>/dev/null | tr -dc '0-9' || true)"
if [[ "${ns1_lines:-0}" == "2" && "${other_lines:-0}" == "1" ]]; then
    echo "  PASS: concurrent session writes its own namespace (no clobber)"
    PASS=$((PASS + 1))
else
    echo "  FAIL: concurrent session clobbered (ns1=$ns1_lines other=$other_lines)"
    FAIL=$((FAIL + 1))
fi

# Stop (same session) must emit ONE batched summary listing both writes, then
# clear the capture log — even with no pending memory to flush.
ns_stop_out=$(echo "{\"session_id\":\"$NS_SID\",\"stop_hook_active\":false}" \
    | bash "$REPO_ROOT/hooks/stop" 2>/dev/null || echo "HOOK_ERROR")
if echo "$ns_stop_out" | grep -q "2 vault write(s) this turn"; then
    echo "  PASS: stop emits ONE batched summary of the turn's writes"
    PASS=$((PASS + 1))
else
    echo "  FAIL: stop did not emit batched summary"
    echo "    Got: $(echo "$ns_stop_out" | head -2)"
    FAIL=$((FAIL + 1))
fi
if [[ ! -e "$NS_PATH/turn-captures.log" ]]; then
    echo "  PASS: stop clears its own turn-captures.log"
    PASS=$((PASS + 1))
else
    echo "  FAIL: stop did not clear the capture log"
    FAIL=$((FAIL + 1))
fi

# W3.2 — flushed memory CONTENT (not just a count) appears in the stop summary.
python3 -c "import json; json.dump([{'section':'Facts','content':'NSFlushFact alpha'}], open('$NS_PATH/pending-memory.json','w'))"
ns_flush_out=$(echo "{\"session_id\":\"$NS_SID\",\"stop_hook_active\":false}" \
    | bash "$REPO_ROOT/hooks/stop" 2>/dev/null || echo "HOOK_ERROR")
if echo "$ns_flush_out" | grep -q "NSFlushFact alpha"; then
    echo "  PASS: stop summary includes flushed memory content"
    PASS=$((PASS + 1))
else
    echo "  FAIL: stop summary omitted flushed content"
    echo "    Got: $(echo "$ns_flush_out" | head -2)"
    FAIL=$((FAIL + 1))
fi

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

# Test 2b: L3 — verify hub data is populated
run_boot_test "L3 — hub data populated" "--cwd $TEST_REPO" \
    "data['project']['stage'] == 'Core Build' and len(data['project']['blockers']) == 1 and 'API keys' in data['project']['blockers'][0] and len(data['project']['open_questions']) == 1 and len(data['project']['recent_decisions']) == 5"

# W3.5 — L2 boot surfaces registered project NAMES (not just bucket names) in
# the active_projects anchor. With the registry above, an L2 session (cwd inside
# vault) should list both buckets and the "Test Project" project name.
run_boot_test "L2 active_projects includes project NAMES (W3.5)" "--cwd $TEST_VAULT" \
    "data['activation_level'] == 2 and data['active_projects'] is not None and 'Test Project' in data['active_projects'] and 'Projects:' in data['active_projects']"

# Test 4: Memory cap
python3 -c "
for i in range(200):
    print(f'Line {i+1}: memory entry')
" > "$TEST_VAULT/memory.md"

run_boot_test "memory cap at 100" "--memory-cap 100" \
    "'Line 101' in data['memory'] and 'Line 1:' not in data['memory'] and 'Line 200' in data['memory']"

# Restore normal memory
echo "# Vault Memory" > "$TEST_VAULT/memory.md"

# Test 7: Dormant feature detection
python3 -c "
for i in range(120):
    print(f'[2026-04-{(i%28)+1:02d}] Entry {i+1}')
" > "$TEST_VAULT/_changelog.txt"

run_boot_test "dormant feature detection" "" \
    "data['feature_suggestion'] is not None and 'weekly_review' in data['feature_suggestion']"

# W3.3 — dormant suppression: the previous boot test just suggested
# weekly_review and wrote its last_suggested date, so a second boot the same
# day must NOT re-suggest the same (and only) dormant feature.
run_boot_test "dormant suppression (no re-suggest same day)" "" \
    "data['feature_suggestion'] is None"

# Clear the suppression state so later tests aren't affected.
rm -f "$TEST_VAULT/.claude/cortex/dormant-suggested.json"

# Restore normal changelog
echo "" > "$TEST_VAULT/_changelog.txt"

# Test: token budget — large memory gets truncated when budget is small
python3 -c "
import sys
# Generate ~20k chars of memory
content = ('memory line padded to ~80 chars per line ' * 250)
print(content)
" > "$TEST_VAULT/memory.md"

run_boot_test "token budget truncates oversized memory" "--budget-chars 2000 --memory-cap 1000" \
    "'_budget' in data and 'memory' in data['_budget']['truncated']"

# Test: budget=0 disables truncation entirely
run_boot_test "token budget=0 disables gate" "--budget-chars 0 --memory-cap 1000" \
    "'_budget' not in data"

# Restore normal memory
echo "# Vault Memory" > "$TEST_VAULT/memory.md"

echo
echo "session-start (v2 integration):"

# Test 8: Full L3 session block
# Override HOME to prevent finding real config, use CORTEX_BOOT_CONFIG for test config
v2_output=$(cd "$TEST_REPO" && HOME="/tmp" \
    CORTEX_BOOT_CONFIG="$TEST_CONFIG" \
    bash "$REPO_ROOT/hooks/session-start" 2>/dev/null || echo "HOOK_ERROR")

v2_pass=true
for pattern in "cortex-boot-required" "MUST invoke the cortex-boot skill" "cortex-session" "Level: L3" "cortex-personality" "cortex-memory" "Test Project"; do
    if ! echo "$v2_output" | grep -q "$pattern"; then
        echo "  FAIL: L3 session block — missing '$pattern'"
        echo "    Got: $(echo "$v2_output" | head -5)"
        FAIL=$((FAIL + 1))
        v2_pass=false
        break
    fi
done
if $v2_pass; then
    echo "  PASS: L3 session block"
    PASS=$((PASS + 1))
fi

# Test 10: vault-path is cached for downstream hooks (replaces the v1.x
# capture-rules/trigger-phrases caching that was removed in the refactor).
if [[ -f "$CLAUDE_PLUGIN_DATA/session-cache/vault-path.txt" ]]; then
    cached_vault="$(cat "$CLAUDE_PLUGIN_DATA/session-cache/vault-path.txt")"
    if [[ "$cached_vault" == "$TEST_VAULT" ]]; then
        echo "  PASS: vault-path cached"
        PASS=$((PASS + 1))
    else
        echo "  FAIL: vault-path cached (wrong path: $cached_vault)"
        FAIL=$((FAIL + 1))
    fi
else
    echo "  FAIL: vault-path cached (file missing)"
    FAIL=$((FAIL + 1))
fi

# Test 11: hub-schema parser agreement (W1.1).
# Python parse_hub and JS read_hub must extract the SAME blockers/questions
# from the same canonical pipe-table hub — the cross-language guard that keeps
# the two parsers from drifting apart again.
echo
echo "hub-schema parser agreement (Python parse_hub == JS read_hub):"
FIXTURE_VAULT="$REPO_ROOT/mcp-servers/cortex-vault/tests/fixtures/vault"
MCP_DIR="$REPO_ROOT/mcp-servers/cortex-vault"
BC_PATH="$REPO_ROOT/hooks/lib/boot-context.py"
if command -v python3 >/dev/null 2>&1 && command -v node >/dev/null 2>&1; then
  agree_out="$(python3 - "$FIXTURE_VAULT" "$MCP_DIR" "$BC_PATH" <<'PYEOF'
import importlib.util, json, subprocess, sys
vault, mcp_dir, bc_path = sys.argv[1], sys.argv[2], sys.argv[3]
proj = "Work/TBL/Test Client/Test Project"
ctx = "Test Project — Project Context.md"

spec = importlib.util.spec_from_file_location("boot_context", bc_path)
bc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bc)
py = bc.parse_hub(vault, {"vault_path": proj, "context_file": ctx})
py_set = {"blockers": sorted(py["blockers"]), "open_questions": sorted(py["open_questions"])}

node_src = (
    "require('./tools/read-hub.js').handler({project_path:process.argv[1]}, process.argv[2])"
    ".then(r=>{const d=JSON.parse(r.content[0].text);"
    "console.log(JSON.stringify({blockers:d.blockers.sort(),open_questions:d.open_questions.sort()}));});"
)
node = subprocess.run(["node", "-e", node_src, proj, vault], cwd=mcp_dir,
                      capture_output=True, text=True)
js_set = json.loads(node.stdout.strip())
if py_set == js_set and py_set["blockers"]:
    print("OK " + json.dumps(py_set))
else:
    print("MISMATCH py=%s js=%s err=%s" % (json.dumps(py_set), json.dumps(js_set), node.stderr.strip()))
PYEOF
)"
  if [[ "$agree_out" == OK* ]]; then
    echo "  PASS: parsers agree ($agree_out)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: parser disagreement — $agree_out"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  SKIP: python3 or node not available"
fi

# Test 12: boot-context token-budget behavior (W1.4).
echo
echo "boot-context token budget (W1.4):"
if command -v python3 >/dev/null 2>&1; then
  if python3 "$REPO_ROOT/tests/test_boot_budget.py" >/dev/null 2>&1; then
    echo "  PASS: budget reserves bucket list, drops overflow cleanly, signals truncation"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: boot budget tests"
    FAIL=$((FAIL + 1))
  fi
else
  echo "  SKIP: python3 not available"
fi

echo
echo "=== Results: $PASS passed, $FAIL failed ==="

# Cleanup — only temp directories, never touches a real vault
rm -rf "$CLAUDE_PLUGIN_DATA"
rm -rf "$TEST_VAULT"
rm -f "$TEST_CONFIG"
rm -rf "$TEST_REPO"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1

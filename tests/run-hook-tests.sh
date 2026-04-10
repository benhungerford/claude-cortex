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
echo "=== Results: $PASS passed, $FAIL failed ==="

# Cleanup — only temp directories, never touches a real vault
rm -rf "$CLAUDE_PLUGIN_DATA"
rm -rf "$TEST_VAULT"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1

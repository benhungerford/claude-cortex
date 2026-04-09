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

# Write vault path cache
echo "/Users/benhungerford/Documents/The Vault" > "$CLAUDE_PLUGIN_DATA/session-cache/vault-path.txt"

# --- Test helpers ---

run_test() {
    local name="$1"
    local hook="$2"
    local fixture="$3"
    local pattern="$4"

    output=$(cat "$FIXTURES/$fixture" | bash "$REPO_ROOT/hooks/$hook" 2>/dev/null || echo "HOOK_ERROR")

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

    output=$(cat "$FIXTURES/$fixture" | bash "$REPO_ROOT/hooks/$hook" 2>/dev/null || echo "HOOK_ERROR")

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

# Clean up any test data the stop hook appended to the real vault
VAULT="/Users/benhungerford/Documents/The Vault"
if [ -f "$VAULT/memory.md" ]; then
    python3 -c "
lines = open('$VAULT/memory.md').readlines()
cleaned = [l for l in lines if 'Hook Test' not in l and 'Test flush' not in l]
while cleaned and cleaned[-1].strip() == '':
    cleaned.pop()
cleaned.append('\n')
with open('$VAULT/memory.md', 'w') as f:
    f.writelines(cleaned)
" 2>/dev/null
fi
# Remove test changelog entry
if [ -f "$VAULT/_changelog.txt" ]; then
    python3 -c "
lines = open('$VAULT/_changelog.txt').readlines()
if lines and 'stop hook' in lines[-1]:
    lines = lines[:-1]
with open('$VAULT/_changelog.txt', 'w') as f:
    f.writelines(lines)
" 2>/dev/null
fi

run_test_empty "bails on active" "stop" "stop-empty.json"

echo
echo "=== Results: $PASS passed, $FAIL failed ==="

# Cleanup
rm -rf "$CLAUDE_PLUGIN_DATA"

[ "$FAIL" -eq 0 ] && exit 0 || exit 1

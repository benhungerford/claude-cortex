# Permission-Free Boot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate all tool permission prompts during session startup by moving vault reads into the session-start hook via a Python helper module.

**Architecture:** A Python module (`hooks/lib/boot-context.py`) handles all vault reading, cwd resolution, and activation level computation. The bash hook (`hooks/session-start`) becomes a thin orchestrator that calls the Python module, caches reference files, and formats platform-specific output. `cortex-boot` becomes a zero-read interpreter of the pre-loaded `<cortex-session>` block.

**Tech Stack:** Python 3 (stdlib only — json, os, re, sys, argparse), Bash

**Spec:** `docs/superpowers/specs/2026-04-10-permission-free-boot-design.md`

---

### Task 1: Python module — core vault reading

**Files:**
- Create: `hooks/lib/boot-context.py`
- Modify: `tests/run-hook-tests.sh`

This task builds the Python module's core: config reading, personality reading, memory reading (with cap), changelog reading, and inbox counting. Outputs JSON. Tested via L1 scenario + edge cases.

- [ ] **Step 1: Create the Python module with config + personality reading**

Create `hooks/lib/boot-context.py`:

```python
#!/usr/bin/env python3
"""Boot context loader for Claude Cortex session-start hook.

Reads vault files, resolves cwd to a project, computes activation level,
and outputs structured JSON to stdout. Called by hooks/session-start.

Exit codes:
  0 — success, JSON on stdout
  1 — no config, no vault, or no personality (onboarding needed)
"""

import argparse
import json
import os
import re
import sys


def read_config(config_path):
    """Read vault_path from config.json. Returns path string or None."""
    try:
        with open(config_path) as f:
            config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    vault_path = config.get("vault_path", "")
    if not vault_path or not os.path.isdir(vault_path):
        return None
    return vault_path


def read_file_or_default(path, default=""):
    """Read a file, returning default if missing."""
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        return default


def read_personality(vault_path):
    """Read personality.md. Returns content string or None if missing."""
    path = os.path.join(vault_path, "personality.md")
    if not os.path.isfile(path):
        return None
    with open(path) as f:
        return f.read()


def read_memory(vault_path, cap=100):
    """Read memory.md, tail-capped at cap lines. Returns string."""
    path = os.path.join(vault_path, "memory.md")
    if not os.path.isfile(path):
        return ""
    with open(path) as f:
        lines = f.readlines()
    if len(lines) > cap:
        lines = lines[-cap:]
    return "".join(lines)


def read_changelog(vault_path, tail=15):
    """Read last N lines of _changelog.txt. Returns (content, total_lines)."""
    path = os.path.join(vault_path, "_changelog.txt")
    if not os.path.isfile(path):
        return "", 0
    with open(path) as f:
        all_lines = f.readlines()
    total = len(all_lines)
    return "".join(all_lines[-tail:]).rstrip("\n"), total


def count_inbox(vault_path):
    """Count .md files in _Inbox/."""
    inbox = os.path.join(vault_path, "_Inbox")
    if not os.path.isdir(inbox):
        return 0
    return sum(1 for f in os.listdir(inbox) if f.endswith(".md"))


def extract_buckets(personality_content):
    """Extract 'Name (Type)' list from personality.md buckets section."""
    fm_match = re.search(r'^---\s*\n(.*?)\n---', personality_content, re.DOTALL)
    if not fm_match:
        return ""
    fm = fm_match.group(1)
    buckets_match = re.search(r'  buckets:\s*\n((?:(?:    | {6,}).*\n)*)', fm)
    if not buckets_match:
        return ""
    entries = re.findall(
        r'-\s+name:\s*"([^"]+)".*?type:\s*"([^"]+)"',
        buckets_match.group(1),
        re.DOTALL,
    )
    return ", ".join(f"{name} ({typ})" for name, typ in entries)


def main():
    parser = argparse.ArgumentParser(description="Cortex boot context loader")
    parser.add_argument("--config", default=os.path.expanduser("~/.claude/cortex/config.json"))
    parser.add_argument("--cwd", default=os.getcwd())
    parser.add_argument("--memory-cap", type=int, default=100)
    args = parser.parse_args()

    # Read config
    vault_path = read_config(args.config)
    if not vault_path:
        sys.exit(1)

    # Read personality (required)
    personality = read_personality(vault_path)
    if not personality:
        sys.exit(1)

    # Read optional files
    memory = read_memory(vault_path, args.memory_cap)
    recent_activity, changelog_total = read_changelog(vault_path)
    inbox_count = count_inbox(vault_path)

    # Placeholder for cwd resolution (Task 2)
    activation_level = 1
    project = None

    # Placeholder for dormant features (Task 3)
    feature_suggestion = None

    # Extract bucket list for L1/L2
    active_projects = extract_buckets(personality) if activation_level < 3 else None

    output = {
        "vault_path": vault_path,
        "activation_level": activation_level,
        "personality": personality,
        "memory": memory,
        "recent_activity": recent_activity,
        "inbox_count": inbox_count,
        "active_projects": active_projects,
        "project": project,
        "feature_suggestion": feature_suggestion,
    }
    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Add test infrastructure and L1 test to the test runner**

Add to the end of `tests/run-hook-tests.sh`, before the cleanup section (before `echo` / `echo "=== Results..."`). Insert a new helper and test section:

```bash
# --- boot-context.py test helpers ---

# Create a personality.md for testing
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

run_boot_test() {
    local name="$1"
    local extra_args="$2"
    local check_expr="$3"

    local output
    output=$(python3 "$REPO_ROOT/hooks/lib/boot-context.py" \
        --config "$TEST_CONFIG" --cwd "/tmp" $extra_args 2>/dev/null) || {
        # If the check expects failure, pass it through
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

echo
echo "boot-context.py:"

# Test 1: L1 — no registry match
run_boot_test "L1 — no registry match" "" \
    "data['activation_level'] == 1 and data['project'] is None and 'Test User' in data['personality'] and data['memory'] != ''"
```

- [ ] **Step 3: Run the tests to verify the L1 test passes**

Run: `bash tests/run-hook-tests.sh`

Expected: The new "boot-context.py: L1 — no registry match" test passes. Earlier tests continue to pass.

- [ ] **Step 4: Add test for missing files (graceful degradation)**

Add after the L1 test in `tests/run-hook-tests.sh`:

```bash
# Test 5: Missing files graceful — remove memory and changelog, keep personality
SAVED_MEMORY="$(cat "$TEST_VAULT/memory.md")"
SAVED_CHANGELOG="$(cat "$TEST_VAULT/_changelog.txt")"
rm -f "$TEST_VAULT/memory.md" "$TEST_VAULT/_changelog.txt"

run_boot_test "missing files graceful" "" \
    "data['memory'] == '' and data['recent_activity'] == '' and data['personality'] != ''"

# Restore
echo "$SAVED_MEMORY" > "$TEST_VAULT/memory.md"
echo "$SAVED_CHANGELOG" > "$TEST_VAULT/_changelog.txt"
```

- [ ] **Step 5: Add test for no config (non-zero exit)**

Add after the missing files test:

```bash
# Test 6: No config — non-zero exit
SAVED_CONFIG="$TEST_CONFIG"
TEST_CONFIG="/tmp/cortex-nonexistent-config-$$.json"
run_boot_test "no config — non-zero exit" "" "EXIT_NONZERO"
TEST_CONFIG="$SAVED_CONFIG"
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `bash tests/run-hook-tests.sh`

Expected: All 3 new boot-context.py tests pass (L1, missing files, no config). All existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add hooks/lib/boot-context.py tests/run-hook-tests.sh
git commit -m "feat: add boot-context.py with core vault reading and L1 tests"
```

---

### Task 2: Python module — cwd resolution

**Files:**
- Modify: `hooks/lib/boot-context.py`
- Modify: `tests/run-hook-tests.sh`

Adds registry reading and cwd walk-up to compute L2/L3 activation levels. Replaces the placeholder `activation_level = 1` with actual resolution logic.

- [ ] **Step 1: Add L2 and L3 tests to the test runner**

These tests will fail until we implement cwd resolution. Add after the "no config" test:

```bash
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
```

- [ ] **Step 2: Run tests to verify L2 and L3 fail**

Run: `bash tests/run-hook-tests.sh`

Expected: "L2 — cwd inside vault" and "L3 — cwd matches registered repo" FAIL. Others pass.

- [ ] **Step 3: Implement cwd resolution in boot-context.py**

Add these functions to `hooks/lib/boot-context.py`, after `extract_buckets()` and before `main()`:

```python
def read_registry(vault_path):
    """Read registry.json. Returns dict with 'projects' list."""
    path = os.path.join(vault_path, ".claude", "cortex", "registry.json")
    try:
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"schema_version": 1, "projects": []}


def resolve_cwd(vault_path, cwd, registry):
    """Resolve cwd to an activation level and optional project entry.

    Returns (level: int, project_entry: dict | None).
    Level 3 = cwd matches a registered repo.
    Level 2 = cwd is inside the vault.
    Level 1 = neither.
    """
    cwd_real = os.path.realpath(cwd)
    vault_real = os.path.realpath(vault_path)
    is_inside_vault = (
        cwd_real == vault_real or cwd_real.startswith(vault_real + os.sep)
    )

    # Walk up from cwd, check each candidate against registry repo_paths
    home = os.path.expanduser("~")
    candidate = cwd_real
    projects = registry.get("projects", [])

    while candidate and candidate != os.path.dirname(candidate):
        for project in projects:
            for repo_path in project.get("repo_paths", []):
                if os.path.realpath(repo_path) == candidate:
                    return 3, project
        parent = os.path.dirname(candidate)
        # Stop at home directory or root
        if candidate == home or parent == candidate:
            break
        candidate = parent

    if is_inside_vault:
        return 2, None

    return 1, None
```

Then replace the placeholder lines in `main()`:

Replace:

```python
    # Placeholder for cwd resolution (Task 2)
    activation_level = 1
    project = None
```

With:

```python
    # Resolve cwd to activation level
    registry = read_registry(vault_path)
    activation_level, project_entry = resolve_cwd(vault_path, args.cwd, registry)

    # Placeholder for hub parsing (Task 3) — just pass the ID through for now
    project = None
    if activation_level == 3 and project_entry:
        project = {
            "id": project_entry["id"],
            "vault_path": project_entry["vault_path"],
            "stage": None,
            "blockers": [],
            "open_questions": [],
            "recent_decisions": [],
        }
```

Also update the `active_projects` line to use `activation_level`:

```python
    active_projects = extract_buckets(personality) if activation_level < 3 else None
```

(This line already uses `activation_level`, but verify it references the variable not a hardcoded `1`.)

- [ ] **Step 4: Run tests to verify L2 and L3 pass**

Run: `bash tests/run-hook-tests.sh`

Expected: All tests pass including "L2 — cwd inside vault" and "L3 — cwd matches registered repo".

- [ ] **Step 5: Commit**

```bash
git add hooks/lib/boot-context.py tests/run-hook-tests.sh
git commit -m "feat: add cwd resolution with registry lookup and L2/L3 tests"
```

---

### Task 3: Python module — hub parsing + dormant features

**Files:**
- Modify: `hooks/lib/boot-context.py`
- Modify: `tests/run-hook-tests.sh`

Adds hub parsing (stage, blockers, open questions, recent decisions) and dormant feature detection. Completes the Python module.

- [ ] **Step 1: Add hub parsing and dormant feature tests**

Add after the L3 test in `tests/run-hook-tests.sh`:

```bash
# Test 2b: L3 — verify hub data is populated
run_boot_test "L3 — hub data populated" "--cwd $TEST_REPO" \
    "data['project']['stage'] == 'Core Build' and len(data['project']['blockers']) == 1 and 'API keys' in data['project']['blockers'][0] and len(data['project']['open_questions']) == 1 and len(data['project']['recent_decisions']) == 5"

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
# Populate changelog with 100+ lines
python3 -c "
for i in range(120):
    print(f'[2026-04-{(i%28)+1:02d}] Entry {i+1}')
" > "$TEST_VAULT/_changelog.txt"

run_boot_test "dormant feature detection" "" \
    "data['feature_suggestion'] is not None and 'weekly_review' in data['feature_suggestion']"

# Restore normal changelog
echo "" > "$TEST_VAULT/_changelog.txt"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bash tests/run-hook-tests.sh`

Expected: "L3 — hub data populated", "memory cap at 100", and "dormant feature detection" FAIL. Others pass.

- [ ] **Step 3: Implement hub parsing in boot-context.py**

Add this function after `resolve_cwd()` and before `main()`:

```python
def parse_hub(vault_path, project_entry):
    """Parse a project context hub for stage, blockers, open questions, decisions.

    Returns dict with keys: stage, blockers, open_questions, recent_decisions.
    Returns None if the hub file doesn't exist.
    """
    hub_path = os.path.join(
        vault_path,
        project_entry["vault_path"],
        project_entry["context_file"],
    )
    if not os.path.isfile(hub_path):
        return None

    with open(hub_path) as f:
        content = f.read()

    result = {
        "stage": None,
        "blockers": [],
        "open_questions": [],
        "recent_decisions": [],
    }

    # Parse Stage Tracker table
    stage_section = re.search(
        r'## Stage Tracker\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)',
        content,
    )
    if stage_section:
        rows = stage_section.group(1).strip().split("\n")
        # First pass: look for "In Progress" or "Current"
        for row in rows:
            cells = [c.strip() for c in row.split("|")[1:-1]]
            if len(cells) >= 2 and cells[1] in ("In Progress", "Current"):
                result["stage"] = cells[0]
                break
        # Fallback: last row with non-empty, non-"Not Started" status
        if not result["stage"]:
            for row in reversed(rows):
                cells = [c.strip() for c in row.split("|")[1:-1]]
                if len(cells) >= 2 and cells[1] and cells[1] != "Not Started":
                    result["stage"] = cells[0]
                    break

    # Parse Open Questions & Blockers table
    oq_section = re.search(
        r'## Open Questions & Blockers\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)',
        content,
    )
    if oq_section:
        rows = oq_section.group(1).strip().split("\n")
        for row in rows:
            cells = [c.strip() for c in row.split("|")[1:-1]]
            if len(cells) < 5:
                continue
            question = cells[1]
            typ = cells[2]
            status = cells[4]
            if not question or status.lower() == "resolved":
                continue
            if typ in ("Dependency", "Internal", "Unknown"):
                result["blockers"].append(question)
            else:
                result["open_questions"].append(question)

    # Recent decisions from project Changelog.md
    changelog_path = os.path.join(
        vault_path, project_entry["vault_path"], "Changelog.md"
    )
    if os.path.isfile(changelog_path):
        with open(changelog_path) as f:
            lines = [l.strip() for l in f.readlines() if l.strip()]
        result["recent_decisions"] = lines[-5:]

    return result


def derive_project_name(project_entry):
    """Derive a human-readable project name from the registry entry."""
    cf = project_entry.get("context_file", "")
    # Strip " — Project Context.md" suffix if present
    if " — Project Context" in cf:
        return cf.split(" — Project Context")[0]
    # Fallback: last segment of vault_path
    vp = project_entry.get("vault_path", "")
    return vp.split("/")[-1] if "/" in vp else project_entry["id"]
```

- [ ] **Step 4: Implement dormant feature detection in boot-context.py**

Add after `derive_project_name()`:

```python
def check_dormant_features(personality_content, changelog_total):
    """Check if any dormant features should be suggested. Returns string or None."""
    if changelog_total < 50:
        return None
    fm_match = re.search(r'^---\s*\n(.*?)\n---', personality_content, re.DOTALL)
    if not fm_match:
        return None
    fm = fm_match.group(1)
    dormant_match = re.search(r'dormant:\s*\n((?:\s+- .*\n)*)', fm)
    if dormant_match and "weekly_review" in dormant_match.group(1):
        return f"weekly_review may be ready to activate (changelog has {changelog_total}+ entries)"
    return None
```

- [ ] **Step 5: Wire hub parsing and dormant features into main()**

Replace the placeholder and project construction in `main()`:

Replace:

```python
    # Placeholder for hub parsing (Task 3) — just pass the ID through for now
    project = None
    if activation_level == 3 and project_entry:
        project = {
            "id": project_entry["id"],
            "vault_path": project_entry["vault_path"],
            "stage": None,
            "blockers": [],
            "open_questions": [],
            "recent_decisions": [],
        }
```

With:

```python
    # Parse hub for L3 sessions
    project = None
    if activation_level == 3 and project_entry:
        hub_data = parse_hub(vault_path, project_entry)
        project = {
            "id": project_entry["id"],
            "name": derive_project_name(project_entry),
            "vault_path": project_entry["vault_path"],
            **(hub_data or {"stage": None, "blockers": [], "open_questions": [], "recent_decisions": []}),
        }
```

Replace:

```python
    # Placeholder for dormant features (Task 3)
    feature_suggestion = None
```

With:

```python
    # Check dormant features
    feature_suggestion = check_dormant_features(personality, changelog_total)
```

- [ ] **Step 6: Run tests to verify all pass**

Run: `bash tests/run-hook-tests.sh`

Expected: All tests pass, including "L3 — hub data populated", "memory cap at 100", and "dormant feature detection".

- [ ] **Step 7: Commit**

```bash
git add hooks/lib/boot-context.py tests/run-hook-tests.sh
git commit -m "feat: add hub parsing, dormant feature detection, and remaining tests"
```

---

### Task 4: Bash hook rewrite

**Files:**
- Rewrite: `hooks/session-start`
- Modify: `tests/run-hook-tests.sh`

Rewrites the bash hook from a 248-line monolith to a ~70-line orchestrator that calls boot-context.py and formats the output. Adds capture-rules.md caching and integration tests.

- [ ] **Step 1: Add integration tests to the test runner**

Add after the boot-context.py test section, before the Results/Cleanup section in `tests/run-hook-tests.sh`:

```bash
echo
echo "session-start (v2 integration):"

# Test 8: Full L3 session block
# Point vault cache at test vault and set cwd to test repo
export PWD="$TEST_REPO"
cd "$TEST_REPO"

# Re-patch the session-start fixture to use our test config path
cat > "$CLAUDE_PLUGIN_DATA/session-start-v2.json" << SEOF
{
  "session_id": "test-session-v2",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "cwd": "$TEST_REPO"
}
SEOF

# Override HOME so boot-context.py finds our test config
export CORTEX_TEST_CONFIG="$TEST_CONFIG"

v2_output=$(cd "$TEST_REPO" && HOME="/tmp" \
    CORTEX_BOOT_CONFIG="$TEST_CONFIG" \
    cat "$CLAUDE_PLUGIN_DATA/session-start-v2.json" | \
    bash "$REPO_ROOT/hooks/session-start" 2>/dev/null || echo "HOOK_ERROR")

v2_pass=true
for pattern in "cortex-session" "Level: L3" "cortex-personality" "cortex-memory" "Test Project"; do
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

# Test 10: Capture-rules cached
if [[ -f "$CLAUDE_PLUGIN_DATA/session-cache/capture-rules.txt" ]]; then
    echo "  PASS: capture-rules cached"
    PASS=$((PASS + 1))
else
    echo "  FAIL: capture-rules cached (file missing)"
    FAIL=$((FAIL + 1))
fi

cd "$REPO_ROOT"
```

- [ ] **Step 2: Rewrite hooks/session-start**

Replace the entire contents of `hooks/session-start` with:

```bash
#!/usr/bin/env bash
set -euo pipefail

# session-start — Load vault context before the model's first turn.
# Calls hooks/lib/boot-context.py for all vault reading and cwd resolution.
# If config is missing or vault doesn't exist, exits silently (onboarding mode).

# ── Resolve paths ────────────────────────────────────────────────────────────

PLUGIN_DATA="${CLAUDE_PLUGIN_DATA:-$HOME/.claude/cortex/plugin-data}"
if [[ -n "${CLAUDE_PLUGIN_ROOT:-}" ]]; then
    PLUGIN_ROOT="$CLAUDE_PLUGIN_ROOT"
else
    PLUGIN_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fi

# Allow test override, otherwise default
CONFIG_FILE="${CORTEX_BOOT_CONFIG:-$HOME/.claude/cortex/config.json}"

# ── Check python3 ───────────────────────────────────────────────────────────

if ! command -v python3 &>/dev/null; then
    exit 0
fi

# ── Call Python module ──────────────────────────────────────────────────────

BOOT_JSON="$(python3 "$PLUGIN_ROOT/hooks/lib/boot-context.py" \
    --config "$CONFIG_FILE" \
    --cwd "${PWD:-/}" 2>/dev/null)" || exit 0

if [[ -z "$BOOT_JSON" ]]; then
    exit 0
fi

# ── Cache reference files ───────────────────────────────────────────────────

CACHE_DIR="$PLUGIN_DATA/session-cache"
mkdir -p "$CACHE_DIR"

for src in "trigger-phrases.md:trigger-phrases.txt" "capture-rules.md:capture-rules.txt"; do
    src_file="$PLUGIN_ROOT/references/${src%%:*}"
    dst_file="$CACHE_DIR/${src##*:}"
    [[ -f "$src_file" ]] && cp "$src_file" "$dst_file"
done

# Cache vault path for other hooks
python3 -c "import json,sys; print(json.loads(sys.stdin.read())['vault_path'], end='')" \
    <<< "$BOOT_JSON" > "$CACHE_DIR/vault-path.txt"

# ── Build session block ─────────────────────────────────────────────────────

SESSION_BLOCK="$(python3 -c "
import json, sys

data = json.loads(sys.stdin.read())
lines = []
lines.append('<cortex-session>')
lines.append(f\"Vault: {data['vault_path']}\")

level = data['activation_level']
level_names = {1: 'L1 \u2014 Passive', 2: 'L2 \u2014 Vault-Aware', 3: 'L3 \u2014 Full Project'}
lines.append(f\"Level: {level_names.get(level, 'L1 \u2014 Passive')}\")

p = data.get('project')
if level == 3 and p:
    lines.append(f\"Project: {p.get('name', p['id'])}\")
    if p.get('stage'):
        lines.append(f\"Stage: {p['stage']}\")
    if p.get('blockers'):
        lines.append(f\"Blockers: {'; '.join(p['blockers'])}\")
    if p.get('open_questions'):
        lines.append(f\"Open questions: {len(p['open_questions'])}\")
    if p.get('recent_decisions'):
        lines.append(f\"Recent decisions: {'; '.join(p['recent_decisions'][-3:])}\")
elif data.get('active_projects'):
    lines.append(f\"Active projects: {data['active_projects']}\")

lines.append('')
lines.append('<cortex-personality>')
lines.append(data.get('personality', '').rstrip())
lines.append('</cortex-personality>')

lines.append('')
lines.append('<cortex-memory>')
lines.append(data.get('memory', '').rstrip())
lines.append('</cortex-memory>')

if data.get('recent_activity'):
    lines.append('')
    lines.append('Recent activity:')
    lines.append(data['recent_activity'])

lines.append(f\"Inbox: {data.get('inbox_count', 0)} unsorted item(s)\")

if data.get('feature_suggestion'):
    lines.append(f\"Feature suggestion: {data['feature_suggestion']}\")

lines.append('</cortex-session>')
print('\n'.join(lines))
" <<< "$BOOT_JSON")"

# ── Escape and output ───────────────────────────────────────────────────────

escape_for_json() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\t'/\\t}"
    printf '%s' "$s"
}

ESCAPED="$(escape_for_json "$SESSION_BLOCK")"

if [[ -n "${CURSOR_PLUGIN_ROOT:-}" ]]; then
    printf '{"additional_context":"%s"}\n' "$ESCAPED"
elif [[ -n "${CLAUDE_PLUGIN_ROOT:-}" && -z "${COPILOT_CLI:-}" ]]; then
    printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$ESCAPED"
else
    printf '{"additionalContext":"%s"}\n' "$ESCAPED"
fi
```

- [ ] **Step 3: Run existing session-start test to verify backward compatibility**

Run: `bash tests/run-hook-tests.sh`

Expected: The original "session-start: loads vault context" test still passes (it checks for "cortex-session" in output). The new integration tests also pass.

Note: The existing test uses `cwd: /home/testuser/vault` in the fixture, but the hook now uses `$PWD` not the fixture's cwd field. The test vault is at `$TEST_VAULT`, and the test runs from `$REPO_ROOT`, so the hook will detect L1 (cwd doesn't match vault or registry). The output will still contain `<cortex-session>`, so the existing test's pattern match (`cortex-session`) will pass.

If the existing test fails because the test vault's personality.md was missing before we added it (it was only `memory.md` and `_changelog.txt`), add personality.md creation earlier in the test runner setup, right after creating the test vault:

Move the `cat > "$TEST_VAULT/personality.md"` block from the boot-context.py section up to the initial vault setup section (after line 18 where `_changelog.txt` is created).

- [ ] **Step 4: Run all tests**

Run: `bash tests/run-hook-tests.sh`

Expected: All tests pass — existing hooks and new boot-context.py + integration tests.

- [ ] **Step 5: Commit**

```bash
git add hooks/session-start hooks/lib/boot-context.py tests/run-hook-tests.sh
git commit -m "feat: rewrite session-start hook to use boot-context.py module"
```

---

### Task 5: Rewrite cortex-boot skill

**Files:**
- Rewrite: `skills/cortex-boot/SKILL.md`

No tests needed — this is a behavioral spec for the model, not executable code. The skill becomes a lightweight interpreter that makes zero file reads.

- [ ] **Step 1: Rewrite cortex-boot SKILL.md**

Replace the entire contents of `skills/cortex-boot/SKILL.md` with:

```markdown
---
name: cortex-boot
description: Always-on session bootstrap. Interprets the <cortex-session> block injected by the session-start hook to determine activation level and guide session behavior. Makes zero file reads — all vault context is pre-loaded by the hook.
---

# cortex-boot

## Purpose

Interpret the vault context already loaded by the session-start hook and apply the appropriate activation level behavior. Every other Cortex skill assumes this interpretation has happened.

The session-start hook (`hooks/session-start`) calls `hooks/lib/boot-context.py` to read all vault files, resolve the working directory to a project, and compute the activation level. The result arrives as a `<cortex-session>` block in the conversation context before the model sees the first message. This skill reads that block — it never reads files directly.

## When this skill fires

- **Every session, first message.** Always. No exceptions.

## Inputs

All inputs come from the `<cortex-session>` block already in the conversation context:

| Field | Location in block |
|---|---|
| Activation level | `Level:` line (L1/L2/L3) |
| Vault path | `Vault:` line |
| Personality | `<cortex-personality>` sub-block |
| Memory | `<cortex-memory>` sub-block |
| Project context (L3) | `Project:`, `Stage:`, `Blockers:`, `Open questions:`, `Recent decisions:` lines |
| Active projects (L1/L2) | `Active projects:` line |
| Recent changelog | `Recent activity:` section |
| Inbox count | `Inbox:` line |
| Dormant feature suggestion | `Feature suggestion:` line (if present) |

## Procedure

**Step 1 — Check for session context.**

Look for a `<cortex-session>` block in the conversation context.

- If absent → **hand off to `cortex-onboarding`**. The hook found no config or no vault.
- If present but `<cortex-personality>` is empty → proceed with reduced context. Note once: `Cortex loaded without personality data.`

**Step 2 — Read the activation level.**

Extract the `Level:` line. It will be one of:
- `L1 — Passive`
- `L2 — Vault-Aware`
- `L3 — Full Project`

If the line is missing or unrecognized, default to L1.

**Step 3 — Apply the activation level contract.**

See `references/activation-levels.md` for the full specification. Summary:

| Level | Visible behavior on first message |
|---|---|
| **L1** | Say nothing. Answer the user's question directly. Watch for capture signals silently. |
| **L2** | Say nothing, unless a stale blocker or urgent inbox item is worth surfacing — one line max. |
| **L3** | One opening line: project name, stage, blocker count. Example: `FKT Shopify Website Build — Integrations stage. 2 open blockers. Ready.` |

**Step 4 — Queue dormant-feature suggestion.**

If the session block contains a `Feature suggestion:` line, queue it for the next natural conversational pause. **Do not surface it during boot.** Maximum one suggestion per session.

**Step 5 — Be ready.**

Do not present a menu. Do not list everything loaded. Do not summarize what you know. Let the user drive the conversation. The personality, memory, and project context are background — use them to inform responses, not to announce them.

## What cortex-boot does NOT do

- **Does not read files.** All context is in `<cortex-session>`.
- **Does not create files.** Boot is read-only.
- **Does not present a menu** or "here's what I know" dump.
- **Does not escalate activation levels past user intent.** A project-name match in an incidental reference does not escalate from L1 to L2.
- **Does not run other skills.** Each task skill is triggered by the user, not by boot.
- **Does not offer dormant-feature suggestions during boot** — only queues them.

## Worked examples

### Example 1 — No session block (first install)

```
User opens Claude Code. No <cortex-session> block in context.

Step 1: No session block → hand off to cortex-onboarding.
cortex-boot does nothing visible. cortex-onboarding takes over.
```

### Example 2 — L1 passive session

```
<cortex-session> block present with Level: L1 — Passive.
User's first message: "how do I reverse a list in Python?"

Step 1: Block present.
Step 2: Level = L1.
Step 3: Say nothing. Answer the Python question directly.
Step 4: Feature suggestion line present → queued for later.
Step 5: Done.
```

### Example 3 — L3 full project session

```
<cortex-session> block present with:
  Level: L3 — Full Project
  Project: FKT Shopify Website Build
  Stage: Integrations
  Blockers: Stripe sandbox credentials; sandbox access expiring Friday

User's first message: "morning, let's pick up where we left off"

Step 1: Block present.
Step 2: Level = L3.
Step 3: Opening line:
  "FKT Shopify Website Build — Integrations stage. 2 open blockers:
  Stripe sandbox credentials and sandbox access (expiring Fri). What
  are we tackling?"
Step 4: No feature suggestion.
Step 5: Done. User drives from here.
```

## Failure modes

| Failure | What cortex-boot does |
|---|---|
| No `<cortex-session>` block in context | Hand off to `cortex-onboarding` with reason "no session context". |
| `<cortex-personality>` sub-block is empty | Proceed with reduced context. One-line note: `Cortex loaded without personality data.` |
| `Level:` line missing or unrecognized | Default to L1. |
| `<cortex-memory>` sub-block is empty | Proceed normally. Memory is optional. |
| Multiple `Feature suggestion:` lines | Pick the first one. Queue it. Ignore the rest. |

## Related

- **Hook:** `hooks/session-start` — produces the `<cortex-session>` block
- **Python module:** `hooks/lib/boot-context.py` — reads vault files and computes activation level
- **References:** `references/activation-levels.md`, `references/capture-rules.md`
- **Handoff target:** `cortex-onboarding` (when no session block is present)
```

- [ ] **Step 2: Commit**

```bash
git add skills/cortex-boot/SKILL.md
git commit -m "feat: rewrite cortex-boot as zero-read interpreter of session hook output"
```

---

### Task 6: Minor updates + final verification

**Files:**
- Modify: `references/activation-levels.md` (lines 78-86)

- [ ] **Step 1: Update the runtime detection section in activation-levels.md**

Replace the "Runtime detection (Stage 3 hook)" section at the end of `references/activation-levels.md` (from `## Runtime detection` to end of file):

```markdown
## Runtime detection

The `session-start` hook computes the activation level at boot and includes it in the `<cortex-session>` block as the `Level:` line:

- `Level: L1 — Passive`
- `Level: L2 — Vault-Aware`
- `Level: L3 — Full Project`

For L3 sessions, the hook also includes the matched project name, current stage, open blockers, open questions, and recent decisions.

The Python module `hooks/lib/boot-context.py` performs the actual resolution: reading `registry.json`, walking up from cwd, and matching against registered `repo_paths`. `cortex-boot` reads the pre-computed level from the session block — it never computes the level itself.
```

- [ ] **Step 2: Run the full test suite**

Run: `bash tests/run-hook-tests.sh`

Expected: All tests pass — existing hook tests, boot-context.py unit tests, and integration tests.

- [ ] **Step 3: Commit**

```bash
git add references/activation-levels.md
git commit -m "docs: update activation-levels.md runtime detection to reflect hook implementation"
```

- [ ] **Step 4: Verify the full file inventory matches the spec**

Check that these files exist and have been modified:

```bash
ls -la hooks/lib/boot-context.py   # NEW
head -3 hooks/session-start         # REWRITTEN (should have boot-context.py reference)
head -3 skills/cortex-boot/SKILL.md # REWRITTEN (should mention zero file reads)
grep "capture-rules" tests/run-hook-tests.sh  # EXTENDED
grep "Runtime detection" references/activation-levels.md  # UPDATED
```

Expected: All files exist. `hooks/session-start` is ~70 lines (down from 248). `skills/cortex-boot/SKILL.md` mentions "zero file reads" in the description.

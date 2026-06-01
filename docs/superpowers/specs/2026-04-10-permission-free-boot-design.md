# Permission-Free Boot — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Goal:** Eliminate all tool permission prompts during session startup by moving vault reads into the session-start hook.

---

## Problem

When Cortex boots, the session-start hook runs permission-free and injects a `<cortex-session>` block with extracted personality fields, recent changelog lines, inbox count, and dormant feature status. But cortex-boot (the skill) fires on the first message and makes Read/MCP tool calls to load `memory.md`, full `personality.md`, resolve cwd to a project, read the project hub, and load capture rules. Each of these triggers a permission prompt, creating friction on every new session.

## Approach

**Architecture:** Bash orchestrator + Python helper module (Approach B).

- A dedicated Python script handles all vault reading, cwd resolution, and data extraction.
- The bash hook stays thin — calls the Python module, caches reference files, and formats the platform-specific JSON output.
- cortex-boot becomes a lightweight interpreter that reads the `<cortex-session>` block already in context instead of making tool calls.

**Content tiering:**

| Content | Strategy | Rationale |
| --- | --- | --- |
| `personality.md` | Full content inlined in `<cortex-session>` | Compact YAML, every skill needs it |
| `memory.md` | Full content inlined, tail-capped at 100 lines | Core context, bounded size |
| Project hub (L3 only) | Structured summary (stage, blockers, open questions, last 5 decisions) | Hubs can be large on mature projects |
| `capture-rules.md` | Cached as file in session-cache | Reference doc, readable on demand |
| `_changelog.txt` | Last 15 lines inlined | Consistent with current behavior |
| cwd resolution | Computed result (level + project name) inlined | No need to expose the registry |

---

## Component 1: Python Helper Module

**File:** `hooks/lib/boot-context.py`

**Inputs (CLI args):**
- `--config` — path to config file (default: `~/.claude/cortex/config.json`)
- `--cwd` — current working directory (default: `$PWD`)
- `--memory-cap` — max lines for memory.md (default: 100)

**Procedure:**

1. Read `config.json`, extract `vault_path`. If file missing or vault doesn't exist, exit with non-zero code.
2. Read `personality.md`. If missing, exit with non-zero code (onboarding needed).
3. Read `memory.md`. If over `--memory-cap` lines, take the last N lines. If missing, return empty string.
4. Read `_changelog.txt`, take last 15 lines. If missing, return empty string.
5. Count `_Inbox/*.md` files.
6. Read `<vault_path>/.claude/cortex/registry.json`. If missing, treat as empty registry.
7. Walk up from `--cwd` toward `/` or `$HOME`. For each candidate path, check against all project `repo_paths` in the registry. First match wins.
8. Compute activation level:
   - cwd matches a registered repo: **L3**
   - cwd is inside `vault_path`: **L2**
   - Neither: **L1**
9. If L3: read the matched project's context hub (`<vault_path>/<project.vault_path>/<project.context_file>`). Extract:
   - Stage (from Stage Tracker table — first row with status containing "In Progress" or "Current"; if none found, use the last row with a non-empty status)
   - Open blockers (from Open Questions & Blockers table — rows where Type is "Dependency", "Internal", or "Unknown" and Status is not "Resolved")
   - Open questions (same table — rows where Type is "Question" and Status is not "Resolved")
   - Recent decisions (from the project's `Changelog.md` at `<vault_path>/<project.vault_path>/Changelog.md` — last 5 non-empty lines; this is distinct from the global `_changelog.txt` used for recent activity)
10. Check dormant features: if `weekly_review` is in personality.md's `progressive_features.dormant` and changelog has 50+ lines, flag for suggestion.

**Output:** JSON to stdout:

```json
{
  "vault_path": "/Users/.../The Vault",
  "activation_level": 3,
  "personality": "---\nidentity:\n  name: ...\n---\n...",
  "memory": "...",
  "recent_activity": "[2026-04-09 21:45] CREATED | ...\n...",
  "inbox_count": 2,
  "project": {
    "id": "fkt-shopify-website-build",
    "name": "FKT Shopify Website Build",
    "vault_path": "Work/TBL/Frankl & Thomas/Shopify Website Build",
    "stage": "Integrations",
    "blockers": ["Stripe sandbox credentials", "sandbox access expiring Friday"],
    "open_questions": ["Payment provider fallback strategy"],
    "recent_decisions": ["Switched to Stripe v3 API", "Deferred Apple Pay to post-launch"]
  },
  "feature_suggestion": "weekly_review may be ready to activate (540+ entries)"
}
```

- `project` is `null` for L1/L2.
- Any field that can't be read returns `null` or empty — never crashes.
- Non-zero exit code means "no vault / onboarding needed" — the bash hook exits silently.

**Error handling:** Each read is wrapped in try/except. A missing or malformed file sets that field to null and continues. The only hard failures are: no config file, no vault directory, no personality.md — these return non-zero exit code.

---

## Component 2: Revised Bash Hook

**File:** `hooks/session-start` (rewritten, same path)

**Responsibilities that stay in bash:**
- Resolve plugin paths (`PLUGIN_ROOT`, `PLUGIN_DATA`, `CONFIG_FILE`)
- Check python3 availability
- Call the Python module and capture output
- Cache reference files to `session-cache/`:
  - `trigger-phrases.txt` (from `references/trigger-phrases.md`) — already cached today
  - `capture-rules.txt` (from `references/capture-rules.md`) — **new**
  - `vault-path.txt` — already cached today
- Build the `<cortex-session>` block from Python's JSON output
- Wrap in platform-specific JSON envelope (Claude Code / Cursor / Copilot CLI)

**Flow:**

```
bash hook starts
  +-- resolve paths (plugin root, config file, cache dir)
  +-- check python3 is available
  |     +-- if not: output minimal <cortex-session> with "Cortex: python3 required", exit
  +-- call: python3 hooks/lib/boot-context.py --config $CONFIG_FILE --cwd $PWD
  |     +-- capture JSON output to variable
  +-- if exit code non-zero or empty: exit 0 silently
  +-- cache trigger-phrases.md, capture-rules.md to session-cache/
  +-- cache vault-path.txt
  +-- parse Python JSON output (extract fields with python3 one-liner or jq)
  +-- build <cortex-session> block (see format below)
  +-- wrap in platform-specific JSON envelope
  +-- print to stdout
```

**Target size:** ~60-80 lines, down from ~248.

**python3 fallback:** python3 is a hard requirement. The current grep-based fallbacks for YAML/JSON parsing are fragile and would not support cwd resolution or hub parsing. macOS ships python3. If unavailable, the hook outputs a one-line context message and exits — the session works, just without vault awareness.

---

## Component 3: New `<cortex-session>` Block Format

**L3 example (full project context):**

```
<cortex-session>
Vault: /Users/.../The Vault
Level: L3 — Full Project
Project: FKT Shopify Website Build
Stage: Integrations
Blockers: Stripe sandbox credentials; sandbox access expiring Friday
Open questions: 1
Recent decisions: Switched to Stripe v3 API; Deferred Apple Pay to post-launch

<cortex-personality>
---
identity:
  name: "Ben Hungerford"
  role: "Web Developer"
  ...
---
(full personality.md content)
</cortex-personality>

<cortex-memory>
(full memory.md content, capped at 100 lines)
</cortex-memory>

Recent activity:
[2026-04-09 21:45] CREATED | FILE: ...
[2026-04-09 21:45] UPDATED [auto] | FILE: ...

Inbox: 0 unsorted item(s)
Feature suggestion: weekly_review may be ready to activate (540+ entries)
</cortex-session>
```

**L1 example (passive, no project):**

```
<cortex-session>
Vault: /Users/.../The Vault
Level: L1 — Passive
Active projects: Frankl & Thomas (Active Project), Kubota Sake (Active Project), ...

<cortex-personality>
...
</cortex-personality>

<cortex-memory>
...
</cortex-memory>

Recent activity:
...

Inbox: 0 unsorted item(s)
</cortex-session>
```

**Key differences from current format:**
- `Level` line is explicit — the model doesn't infer activation level
- `Project/Stage/Blockers/Open questions/Recent decisions` appear for L3 only
- `<cortex-personality>` sub-block contains full file content
- `<cortex-memory>` sub-block contains full memory.md (tail-capped)
- `Active projects` line appears for L1/L2 (quick reference from personality buckets) but is replaced by the focused project summary for L3

---

## Component 4: Changes to cortex-boot Skill

**File:** `skills/cortex-boot/SKILL.md` (rewritten)

cortex-boot becomes a lightweight interpreter. It makes **zero file reads**.

**New procedure:**

1. Read the `<cortex-session>` block from conversation context. Extract the `Level` line.
2. Apply the activation level contract:
   - **L1:** Say nothing. Answer the user's question directly.
   - **L2:** Say nothing unless a stale blocker or inbox item is worth surfacing (one line max).
   - **L3:** One opening line — project name, stage, blocker count. Example: `FKT Shopify Website Build — Integrations stage. 2 open blockers. Ready.`
3. Watch for capture signals for the rest of the session.
4. Queue one dormant-feature suggestion if the hook flagged one.

**Onboarding handoff:** If no `<cortex-session>` block is present in the conversation (Python module returned non-zero, hook exited silently), cortex-boot detects the absence and hands off to cortex-onboarding. Same behavior as today, no change needed.

**What cortex-boot stops doing:**
- Reading `config.json`
- Reading `personality.md`
- Reading `memory.md`
- Reading `_changelog.txt`
- Running `workflows/resolve-cwd.md`
- Reading the project hub
- Checking dormant features

---

## Component 5: File Caching

**Directory:** `$PLUGIN_DATA/session-cache/`

| File | Source | Status |
| --- | --- | --- |
| `trigger-phrases.txt` | `references/trigger-phrases.md` | Exists today, no change |
| `vault-path.txt` | Extracted from config.json | Exists today, no change |
| `capture-rules.txt` | `references/capture-rules.md` | **New** |

capture-rules.md is a reference doc that skills may need mid-session when evaluating Tier 1/2/3 capture signals. Caching it avoids a Read call to the plugin directory.

---

## Test Plan

### Python module tests (1-7)

Tests call `python3 hooks/lib/boot-context.py` directly and validate JSON output.

| # | Scenario | Setup | Expected |
| --- | --- | --- | --- |
| 1 | L1 — no registry match | Temp vault with personality, memory, changelog. cwd = `/tmp/random` | `activation_level: 1`, `project: null`, personality + memory present |
| 2 | L3 — cwd matches repo | Temp vault with registry entry + hub file. cwd = registered repo path | `activation_level: 3`, project populated with stage, blockers, questions |
| 3 | L2 — cwd inside vault | cwd = vault path | `activation_level: 2`, `project: null` |
| 4 | Memory cap | 200-line memory.md, `--memory-cap 100` | Output contains last 100 lines only |
| 5 | Missing files graceful | personality.md only, no memory/registry/changelog | Exits successfully, missing fields are empty |
| 6 | No config — non-zero exit | Config path doesn't exist | Non-zero exit code, no output |
| 7 | Dormant feature detection | personality.md with `weekly_review` dormant, 100+ line changelog | `feature_suggestion` populated |

### Integration tests (8-10)

Tests go through the bash hook using the existing `run_test()` pattern.

| # | Scenario | Expected |
| --- | --- | --- |
| 8 | Full L3 session block | Output contains `<cortex-session>`, `Level: L3`, `<cortex-personality>`, `<cortex-memory>`, project fields |
| 9 | No python3 fallback | Output contains minimal context message, no crash |
| 10 | Capture-rules cached | `session-cache/capture-rules.txt` exists after hook runs |

---

## Files Changed

| File | Action |
| --- | --- |
| `hooks/lib/boot-context.py` | **New** — Python helper module |
| `hooks/session-start` | **Rewrite** — thin bash orchestrator |
| `skills/cortex-boot/SKILL.md` | **Rewrite** — zero-read interpreter |
| `tests/run-hook-tests.sh` | **Extend** — add 10 new test cases |
| `tests/fixtures/` | **New fixtures** — L1, L2, L3 scenarios for Python module and integration tests |

## Files NOT Changed

- `references/capture-rules.md` — no changes, just cached.
- Other hooks (`post-tool-use`, `user-prompt-submit`, `stop`) — untouched.
- Other skills — untouched. They benefit passively because personality and memory are already in context.

## Minor Updates

- `references/activation-levels.md` — update the "Runtime detection (Stage 3 hook)" section (lines 80-86) to reflect that the hook now computes activation level and includes it in `<cortex-session>`. Replace the planned env var approach with the actual implementation.

---
name: cortex-register-repo
description: The repo-to-vault bridge. Three operations under one skill — (1) register a single code repo against a vault project and write a Cortex stub CLAUDE.md into it, (2) backfill-scan a parent folder to bulk-register every repo found, (3) resolve the current working directory to a registered project by walking up the directory tree. Fires on "register this repo", "link this folder", "scan for repos", "what project is this cwd", or when an orphaned Cortex stub is detected.
---

# cortex-register-repo

## Purpose

Make Cortex work from inside a code repo, not just from inside the vault. Registers the bridge once; after that, any future Claude Code session inside the registered repo auto-loads the matching project's context via `cortex-boot`'s cwd resolution.

Three distinct sub-operations under one skill:

| Operation | Triggered by | Workflow |
|---|---|---|
| **Register** (single repo) | "register this repo", "link this folder", new project step 6.2 | `workflows/register-repo.md` |
| **Backfill** (bulk scan) | "scan for repos", "backfill repos", "register all my repos" | `workflows/backfill-repos.md` |
| **Resolve cwd** (lookup) | `cortex-boot` step 4, "what project is this", orphaned stub detected | `workflows/resolve-cwd.md` |

## When this skill fires

**Literal triggers:**
- Register: "register this repo", "link this folder", "link this repo to a project", "this repo is for <Project>"
- Backfill: "scan for repos", "backfill repos", "find my project folders", "register all my repos"
- Resolve: "what project am I in", "what repo is this", "which project is this cwd"

**Structural triggers:**
- Orphaned stub detected (walking up from cwd finds a `CLAUDE.md` with Cortex stub phrases, but `resolve-cwd` returns no registry match)
- `cortex-boot` calls this skill as part of its own step 4 (cwd resolution) — that's an internal handoff, not a user-facing trigger

See rows 17–20 in `references/trigger-phrases.md`.

## Architecture recap

Three files, three jobs — see `references/bridge-architecture.md` for the full design:

| File | Lives at | Job |
|---|---|---|
| Global config | `~/.claude/cortex/config.json` | Tells Cortex where the vault is |
| Registry | `<vault>/.claude/cortex/registry.json` | Maps repo paths → vault projects |
| Repo stub | `<repo>/CLAUDE.md` | Static stub. Says "invoke Cortex". Contains zero vault knowledge. |

The registry is the source of truth. The stub is disposable. The config is tiny and rarely changes.

## Sub-operation: Register (single repo)

Run `workflows/register-repo.md`. Summary:

1. **Validate** the supplied `repo_path` — exists, is a directory, not already in another project's `repo_paths`
2. **Update the registry** at `<vault>/.claude/cortex/registry.json` — append to the existing project entry or create a new one
3. **Write the stub** at `<repo_path>/CLAUDE.md` — use `assets/repo-claude-stub.md` as the source. If a `CLAUDE.md` already exists, show the first 20 lines and ask before replacing.
4. **Log to `_changelog.txt`** — two entries if a new stub was written (one for the registry update, one for the stub)
5. **Confirm** with a tight summary

**Inputs** (supplied by the caller — usually `cortex-ingest-project` or the user directly):
- `project_id` — slug (e.g., `jumpstart-sc-wordpress-build`)
- `vault_path` — relative path inside the vault (e.g., `Work/Personal/Jumpstart SC/WordPress Website Build`)
- `context_file` — filename of the Project Context hub
- `repo_path` — absolute path to the repo root

If the user invokes register directly ("register this repo"), ask:
- "What's the absolute path to the repo root?" (unless you can derive it from cwd)
- "Which project does this repo belong to?" (fuzzy-match against known projects)

## Sub-operation: Backfill (bulk scan)

Run `workflows/backfill-repos.md`. Summary:

1. **Ask for scan roots** — default `~/Documents/Freelance Projects/`, accept comma-separated overrides
2. **Walk each root one level deep** — list immediate subdirs, classify each as Strong (has `CLAUDE.md`), Possible (fuzzy matches a vault project name), or No Match
3. **Build a confirmation list** — show each proposed match, ask the user to confirm Y/n/skip in one pass
4. **Call register-repo** for each confirmed match
5. **Summarize** — registered count, skipped count, conflicts

Backfill is destructive-adjacent: it writes `CLAUDE.md` stubs into multiple repos in one pass. Always use the confirmation step — never auto-register without explicit Y/skip input.

## Sub-operation: Resolve cwd (lookup)

Run `workflows/resolve-cwd.md`. Summary:

1. **Load config** — `~/.claude/cortex/config.json` → `vault_path`
2. **Load registry** — `<vault>/.claude/cortex/registry.json`. Treat missing as empty.
3. **Walk up** from current cwd, checking each ancestor path against every project's `repo_paths`. First match wins.
4. **If no match, check for an orphaned stub** — walk up a second time looking for any `CLAUDE.md` containing "Cortex-managed repo" or "invoke the Cortex skill"
5. **Return one of**: `{match: <project>}`, `{status: "orphaned", stub_path: <path>}`, or `{status: "unregistered"}`

**Caller behavior** (usually `cortex-boot`):
- `match` → load that project's hub, escalate to L3 Full Project
- `orphaned` → this skill handles the orphan prompt (see below)
- `unregistered` → do nothing, return to L1

### Orphan handling

When an orphaned stub is detected, this skill prompts the user once:

> "This looks like a Cortex-managed repo, but I don't recognize this path. Is this <closest-fuzzy-match>? Or type a project name / skip."

On confirmation:
1. Update the matched project's `repo_paths` to add the current path
2. Write `_changelog.txt` entry
3. Proceed as if the cwd had resolved normally (escalate to L3)

On `skip`: stay silent, do not prompt again in this session.

## Critical rules

**The registry is the source of truth.** Repo stubs are disposable and contain zero vault knowledge. If the stub drifts from the registry, the registry wins.

**Walk-up matching is path-based, not git-based.** Cortex doesn't care if a repo has a `.git` folder. It matches on filesystem paths stored in `repo_paths`. This lets the bridge work for non-git directories (a plain folder of WordPress files, a design asset folder, etc.).

**First match wins during walk-up.** If for some reason two registry entries both contain an ancestor of cwd, pick the more-specific (longer) path. Log a warning — that shouldn't happen and indicates a data quality issue.

**Never overwrite an existing CLAUDE.md without confirmation.** Even if it's tiny. Always show the first 20 lines and ask.

**Stale paths are loud, not silent.** If `resolve-cwd` returns a project and that project's context file is missing or moved, surface an error to the user immediately — don't fall back silently to L1.

## Worked examples

### Example 1 — Register a single repo, new entry

```
User is in ~/Documents/Freelance Projects/bubl-shots-compliance/ in a
Claude Code session. First turn: "register this repo against Bubl Shots
age verification".

Sub-operation: Register.

Inputs derived:
  repo_path = ~/Documents/Freelance Projects/bubl-shots-compliance (from cwd)
  project_id = bubl-shots-age-verification (fuzzy match)
  vault_path = Work/TBL/Bubl Shots/Age Verification & Compliance
  context_file = Age Verification & Compliance — Project Context.md

Step 1: Validate. Path exists. Not in any existing repo_paths.

Step 2: Update registry. Project doesn't have an entry yet — create one:
  {
    "id": "bubl-shots-age-verification",
    "vault_path": "Work/TBL/Bubl Shots/Age Verification & Compliance",
    "context_file": "Age Verification & Compliance — Project Context.md",
    "repo_paths": ["/Users/ben/Documents/Freelance Projects/bubl-shots-compliance"]
  }

Step 3: Write stub. No existing CLAUDE.md. Copy from
  ${CLAUDE_PLUGIN_ROOT}/assets/repo-claude-stub.md.

Step 4: Log 2 entries to _changelog.txt.

Step 5: Confirm:
  "✓ Registered bubl-shots-age-verification
    Repo: ~/Documents/Freelance Projects/bubl-shots-compliance
    Stub: wrote new CLAUDE.md"
```

### Example 2 — Backfill from a parent folder

```
User: "scan my repos"

Sub-operation: Backfill.

Step 1: Ask for scan roots.
  "I can scan a folder for existing project repos and register them. Where
   should I look? Default: ~/Documents/Freelance Projects/"

User: accepts default.

Step 2: List immediate subdirs:
  ~/Documents/Freelance Projects/fkt-checkout          (has CLAUDE.md, strong)
  ~/Documents/Freelance Projects/jumpstart-wp          (no CLAUDE.md, fuzzy matches Jumpstart SC)
  ~/Documents/Freelance Projects/fond-homepage         (no CLAUDE.md, fuzzy matches FOND)
  ~/Documents/Freelance Projects/random-sandbox        (no match)

Step 3: Confirmation list:
  "Found possible repos. Confirm matches:
    ~/Documents/Freelance Projects/fkt-checkout    → Frankl & Thomas / Shopify Website Build  [Y/n/skip]
    ~/Documents/Freelance Projects/jumpstart-wp    → Jumpstart SC / WordPress Website Build   [Y/n/skip]
    ~/Documents/Freelance Projects/fond-homepage   → FOND / Ongoing Store Development         [Y/n/skip]
    ~/Documents/Freelance Projects/random-sandbox  → no clear match — type a name or [skip]"

User responds: "Y Y Y skip"

Step 4: Call register-repo 3 times.

Step 5: Summarize:
  "Backfill complete.
    Registered: 3 repos
    Skipped: 1
    Conflicts: 0 (fkt-checkout had existing CLAUDE.md — kept existing since
                  it was already a Cortex stub)"
```

### Example 3 — Orphaned stub

```
cortex-boot resolves cwd at ~/Work/old-fkt-backup/. resolve-cwd walks up,
finds CLAUDE.md with Cortex stub phrases, but no registry entry points here.
Returns {status: "orphaned", stub_path: ~/Work/old-fkt-backup/CLAUDE.md}.

cortex-boot hands off to this skill.

Prompt:
  "This looks like a Cortex-managed repo, but I don't recognize the path
   (~/Work/old-fkt-backup/). Is this FKT / Shopify Website Build? Or type
   a different project name / skip."

User: "no, this is an old backup — skip"

Action: stay silent. Do not add to registry. Do not re-prompt this session.
Activation level stays at L1.

User continues working. Cortex does not nag.
```

### Example 4 — Lookup only, no write

```
User (inside ~/projects/fkt-checkout): "what project is this cwd?"

Sub-operation: Resolve cwd.

Result: match → Frankl & Thomas / Shopify Website Build.

Response (read-only, no registry change):
  "This is FKT Shopify Website Build. Current stage: Integrations.
   2 open blockers.  You can say 'status' for more detail."
```

## Failure modes

| Failure | What to do |
|---|---|
| `repo_path` doesn't exist | Surface the error. Do not register. |
| `repo_path` is already in another project's `repo_paths` | Surface the conflict: show which project owns it, ask the user whether to move it, leave it, or cancel. |
| Registry file (`<vault>/.claude/cortex/registry.json`) doesn't exist | Create it with an empty `{"schema_version": 1, "projects": []}` structure. Log as `CREATED`. Then proceed. |
| Registry file exists but has malformed JSON | Surface the parse error. Do not write over a corrupt file — ask the user to fix it first. |
| Existing `CLAUDE.md` in the target repo | Show first 20 lines, ask "replace with Cortex stub? (yes / no / show full diff)". Never silently replace. |
| User says "register this repo" but isn't in a cwd that looks like a repo (e.g. inside a user home directory, or a cloud storage folder) | Ask for confirmation: "Your cwd is <path>. Are you sure this is a repo?" Explain the consequence (writes CLAUDE.md to this location). |
| Backfill scan root doesn't exist | Prompt again with the list of valid paths the user has entered. Do not silently fall back to a default. |
| Backfill finds 20+ repos and confirmation would be overwhelming | Paginate: show 10 at a time, take one batch of confirmations, then the next. Never silently auto-register. |
| resolve-cwd finds a registry entry but the project's vault_path doesn't exist (folder moved, vault restructured) | Surface: "Registry entry for <project> points at <path> but that folder doesn't exist. Has the vault been restructured? Update the registry or re-register this repo." Do not fall back to L1 silently. |
| Multiple projects fuzzy-match the orphan | Show all matches, ask the user to pick or type a specific name. Do not pick for them. |

## What this skill does NOT do

- Does not write anything to the vault's content files (hubs, changelogs, sub-notes). Only touches the registry and the repo stub.
- Does not do content-based matching — no reading of README files or package.json to guess the project. Match is on folder name only.
- Does not run git commands. The bridge is path-based, not VCS-aware.
- Does not create projects. If the user wants to register a repo to a non-existent project, hand off to `cortex-ingest-project` first.

## Related

- **Workflows:** `workflows/register-repo.md`, `workflows/backfill-repos.md`, `workflows/resolve-cwd.md`
- **References:** `references/bridge-architecture.md`
- **Assets:** `assets/repo-claude-stub.md` (the static stub file)
- **Callers:** `cortex-boot` (for cwd resolution on every session), `cortex-ingest-project` (step 4.5 / step 6.2, when a new project wants to link a repo)
- **Handoff target:** `cortex-ingest-project` (if the user wants to register a repo to a project that doesn't exist yet)
- **Triggers:** rows 17–20 in `references/trigger-phrases.md`

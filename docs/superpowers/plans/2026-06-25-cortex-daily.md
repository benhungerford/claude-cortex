# cortex-daily Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a core Cortex skill, `cortex-daily`, that generates a tailored, copy-paste prompt for a Claude Routine which runs an unattended daily pipeline (pull from live connectors → dedup → file into vault → assemble a stepped briefing).

**Architecture:** Approach C — "skeleton + composed bodies." The skill is a generator (interactive); it emits a self-contained output prompt built from a LOCKED skeleton (`assets/routine-skeleton.md` — boot, dedup guard, autonomy/routing, file+log discipline) plus section bodies composed at generate-time from `assets/section-library.md` recipes. Output goes to chat + a saved copy at `.claude/cortex/daily-routine.md`; re-runs diff against the saved copy.

**Tech Stack:** Markdown skill files (SKILL.md, workflows, assets); Python `unittest` for structural tests (run with `python3 tests/test_*.py`, matching existing `tests/test_activation.py`); `tests/scenarios.md` for human-runnable behavioral acceptance; `cortex-vault` MCP tools at run-time.

## Global Constraints

- Skill lives in Cortex core: `skills/cortex-daily/` (skills are auto-discovered from `skills/`; no `plugin.json` enumeration needed). Verbatim from spec decision 5.
- Frontmatter tags everywhere must be **quoted strings** (`"#tag/value"`); unquoted `#` parses to null.
- The output prompt's locked rails are non-customizable: dedup guard, ambiguous→`_Inbox/`, log every write, never delete/overwrite/duplicate, no mid-run questions. Verbatim from spec.
- Sections are **connector-agnostic**: key off connector *type* (email, project-management, transcript/recording, calendar), never a hardcoded vendor. Verbatim from spec decision 8.
- YouTube section is **silent/opt-in**: never proposed; surfaced only on explicit user request. Verbatim from spec decision 7.
- Output artifact: **chat + saved copy** at `.claude/cortex/daily-routine.md`. Verbatim from spec decision 3.
- Refresh is **diff + confirm**, preserving prior section choices. Verbatim from spec decision 9.
- Prefer `cortex-vault` MCP tools over manual file ops; include literal fallbacks for MCP-absent environments.
- Python tests use `unittest` and read files relative to repo root; run individually as `python3 tests/test_cortex_daily.py`.
- Spec reference: `docs/superpowers/specs/2026-06-25-cortex-daily-design.md`.

---

### Task 1: Skill scaffold — `SKILL.md` + structural test harness

**Files:**
- Create: `skills/cortex-daily/SKILL.md`
- Create: `tests/test_cortex_daily.py`

**Interfaces:**
- Produces: the test module `tests/test_cortex_daily.py` with a `SKILL_DIR` constant (`<repo>/skills/cortex-daily`) and a helper `read(rel)` returning file text relative to that dir. Later tasks add test classes to this same module.

- [ ] **Step 1: Write the failing test**

Create `tests/test_cortex_daily.py`:

```python
#!/usr/bin/env python3
"""Structural tests for the cortex-daily skill assets.

Run: python3 tests/test_cortex_daily.py
"""
import os
import re
import unittest

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SKILL_DIR = os.path.join(REPO_ROOT, "skills", "cortex-daily")


def read(rel):
    with open(os.path.join(SKILL_DIR, rel), encoding="utf-8") as f:
        return f.read()


def read_repo(rel):
    with open(os.path.join(REPO_ROOT, rel), encoding="utf-8") as f:
        return f.read()


class TestSkillManifest(unittest.TestCase):
    def test_skill_md_exists_with_frontmatter(self):
        text = read("SKILL.md")
        self.assertTrue(text.startswith("---"), "SKILL.md must open with YAML frontmatter")
        fm = text.split("---", 2)[1]
        self.assertIn("name: cortex-daily", fm)
        self.assertRegex(fm, r"description:\s+\S")

    def test_skill_md_declares_triggers(self):
        text = read("SKILL.md").lower()
        for phrase in ["daily routine", "daily briefing", "daily pipeline"]:
            self.assertIn(phrase, text, f"SKILL.md must list trigger: {phrase}")

    def test_skill_md_points_to_workflow(self):
        self.assertIn("workflows/generate-routine.md", read("SKILL.md"))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/.claude/plugins/marketplaces/benhungerford-claude-cortex && python3 tests/test_cortex_daily.py`
Expected: FAIL — `FileNotFoundError` for `skills/cortex-daily/SKILL.md`.

- [ ] **Step 3: Write minimal implementation**

Create `skills/cortex-daily/SKILL.md`:

````markdown
---
name: cortex-daily
description: Generates a tailored, copy-paste prompt for a Claude Routine that runs an unattended daily pipeline — pull from all live connectors, dedup, file content into the correct vault folders, and assemble a stepped daily briefing. Fires on "set up my daily routine", "build my daily briefing", "create a daily pipeline", or the daily_briefing progressive-feature activation handoff.
---

# cortex-daily

## Purpose

Generate a self-contained prompt the user pastes into a Claude **Routine** (the scheduled, recurring run feature). The generated routine runs unattended each day and executes the full pipeline: pull from every live connector → dedup → route/file into the correct vault folders → assemble a stepped daily briefing → write it and log everything.

This skill is a **generator**, not a runner. It inspects the vault and live connectors, runs a short interview for custom sections, then emits the prompt to chat and saves a copy. Claude Routines owns scheduling and execution.

Full playbook: `workflows/generate-routine.md`.

## When this skill fires

**Literal triggers:**
- "set up my daily routine", "build my daily briefing", "create a daily pipeline"
- "/cortex-daily"
- "generate my morning routine", "make a daily routine prompt"

**Handoff trigger:**
- The dormant `daily_briefing` progressive-feature activation prompt routes here on "yes" (see `references/progressive-features.md`).

## MCP Tool Preferences

When the `cortex-vault` MCP server is available, prefer these over manual file ops:

| Instead of... | Use MCP tool |
|---|---|
| Resolving the vault path | `find_project_by_cwd` (falls back to `~/.claude/cortex/config.json` → `vault_path`) |
| Enumerating projects + buckets | `list_projects` |
| Logging the generate/refresh op | `append_changelog` |

If MCP tools are unavailable (Desktop without the server), read `~/.claude/cortex/config.json` for `vault_path` and append to `_changelog.txt` manually.

## Procedure

Run `workflows/generate-routine.md`. It covers:

1. Resolve the vault path.
2. Auto-detect inputs (projects, `personality.md`, live connectors grouped by type, existing saved routine).
3. Present the inferred profile and confirm connectors + run-time.
4. Run the custom-section interview (canonical menu auto-filtered to live connectors; YouTube opt-in only).
5. Assemble the output prompt: fill `assets/routine-skeleton.md` rails, inject composed section bodies from `assets/section-library.md` in the user's order.
6. Emit to chat (fenced) and save `.claude/cortex/daily-routine.md`; log via `append_changelog`.
7. Instruct the user to paste it into a new Claude Routine at the chosen time.

## Critical rules

- The output prompt's locked rails are non-negotiable: dedup guard, ambiguous→`_Inbox/`, log every write, never delete/overwrite/duplicate, no mid-run questions. They come from `assets/routine-skeleton.md` and must never be edited away during customization.
- Sections key off connector **type**, never a hardcoded vendor. The composed body names the actual detected tool.
- Never propose the YouTube section; surface it only if the user explicitly asks.
- If `personality.md` is missing, stop and route to `cortex-onboarding`.

## What this skill does NOT do

- Does not schedule the routine (Claude Routines does).
- Does not run the briefing inline (generator only).
- Does not modify `personality.md` or `memory.md`.

## Related

- **Workflow:** `workflows/generate-routine.md`
- **Assets:** `assets/routine-skeleton.md`, `assets/canonical-sections.md`, `assets/section-library.md`
- **Spec:** `docs/superpowers/specs/2026-06-25-cortex-daily-design.md`
- **Wiring:** `references/trigger-phrases.md`, `references/progressive-features.md`
````

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 tests/test_cortex_daily.py`
Expected: PASS (3 tests in `TestSkillManifest`).

- [ ] **Step 5: Commit**

```bash
git add skills/cortex-daily/SKILL.md tests/test_cortex_daily.py
git commit -m "feat(cortex-daily): scaffold SKILL.md + structural test harness"
```

---

### Task 2: Locked skeleton — `assets/routine-skeleton.md`

**Files:**
- Create: `skills/cortex-daily/assets/routine-skeleton.md`
- Modify: `tests/test_cortex_daily.py` (add `TestSkeleton`)

**Interfaces:**
- Consumes: `read()` helper from Task 1.
- Produces: `assets/routine-skeleton.md` containing markers `PART 0`–`PART 6` and a literal injection marker `<!-- INJECT: SECTION BODIES -->` that the generator replaces with composed sections.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_cortex_daily.py` (before the `if __name__` block):

```python
class TestSkeleton(unittest.TestCase):
    def setUp(self):
        self.text = read("assets/routine-skeleton.md")

    def test_has_all_seven_locked_parts(self):
        for n in range(0, 7):
            self.assertIn(f"PART {n}", self.text, f"skeleton missing PART {n}")

    def test_unattended_no_questions_rule(self):
        low = self.text.lower()
        self.assertIn("unattended", low)
        self.assertIn("never pause", low)

    def test_dedup_guard_matches_on_id_not_filename(self):
        self.assertIn("MATCH ON THE ID", self.text)
        self.assertIn("_pipeline_state.json", self.text)

    def test_autonomy_rules_present(self):
        low = self.text.lower()
        self.assertIn("_inbox", low)
        self.assertIn("never delete", low)
        self.assertIn("never duplicate", low)

    def test_has_section_injection_marker(self):
        self.assertIn("<!-- INJECT: SECTION BODIES -->", self.text)

    def test_writes_briefing_and_logs(self):
        low = self.text.lower()
        self.assertIn("daily briefings/", low)
        self.assertIn("append_changelog", low)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 tests/test_cortex_daily.py`
Expected: FAIL — `FileNotFoundError` for `assets/routine-skeleton.md`.

- [ ] **Step 3: Write minimal implementation**

Create `skills/cortex-daily/assets/routine-skeleton.md`:

````markdown
# Daily Routine Skeleton (LOCKED RAILS)

The generator fills the `<...>` slots and replaces `<!-- INJECT: SECTION BODIES -->`
with the user's composed section bodies. Every other line is non-customizable.

---

PART 0 — IDENTITY & MODE
You are running an UNATTENDED daily Cortex pipeline for <user>.
Vault: <vault_path>. No human is present — never pause to ask a question.
Any question for the user goes in the briefing's Follow-up section, never in chat.

PART 1 — BOOT
- Read personality.md, the vault rule files (CLAUDE.md / .claude/rules), and memory.md.
- Read the last 50 lines of _changelog.txt.
- Read yesterday's briefing in Daily Briefings/: carry forward every unchecked
  critical (red) action item; pick up any answers the user left in its Follow-up section.

PART 2 — DEDUP GUARD (MANDATORY, runs before creating anything)
For every item pulled from any connector:
  a. Cursor check: compare its source ID against _pipeline_state.json
     (granola.last_processed_ids, fathom.last_processed_ids,
     <email>.last_processed_thread_ids, etc.). If present, it was already processed.
  b. Vault check: grep the vault for the source ID (e.g. `granola_id: <id>`).
     MATCH ON THE ID, NEVER THE FILENAME — curated notes get renamed.
If already present: skip, or merge only genuinely new detail into the existing note.
After filing a new item, append its ID to the matching _pipeline_state.json cursor.

PART 3 — PULL (per live connector)
For each connector below, fetch items since the last run, then run each through
PART 2 (dedup) and PART 4 (route & file):
<connector_pull_list>

PART 4 — ROUTE & FILE (autonomy rules)
- Confidently routed (matches an auto-routing signal or has a clear project tie):
  file it into the correct folder; add frontmatter with QUOTED tags; add a
  `*Related:* [[_MOC]]` footer; update the folder's _MOC; append_changelog.
- Ambiguous: move to _Inbox/ and flag it in the Inbox Residue section.
- NEVER delete content. NEVER overwrite a note silently. NEVER create a duplicate.

PART 5 — ASSEMBLE BRIEFING
Build the briefing body from these sections, in this order:
<!-- INJECT: SECTION BODIES -->

PART 6 — WRITE & LOG
- Write the briefing to Daily Briefings/<YYYY-MM-DD>.md with frontmatter
  `type: daily-briefing` and quoted tags.
- append_changelog a CREATED entry for the briefing file.
- Stop. Do not send a chat message — the briefing file IS the output.

(If the cortex-vault MCP tools are unavailable in the routine environment, perform
the equivalent file operations directly and append to _changelog.txt using the
format: `[YYYY-MM-DD HH:MM] ACTION | FILE: name | DEST: path/ | NOTE: context`.)
````

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 tests/test_cortex_daily.py`
Expected: PASS (`TestSkeleton` + Task 1 tests).

- [ ] **Step 5: Commit**

```bash
git add skills/cortex-daily/assets/routine-skeleton.md tests/test_cortex_daily.py
git commit -m "feat(cortex-daily): add locked output-prompt skeleton"
```

---

### Task 3: Default section menu — `assets/canonical-sections.md`

**Files:**
- Create: `skills/cortex-daily/assets/canonical-sections.md`
- Modify: `tests/test_cortex_daily.py` (add `TestCanonicalSections`)

**Interfaces:**
- Produces: `assets/canonical-sections.md` listing 11 default sections (NOT YouTube) with each section's required connector type (or `—` for vault-internal).

- [ ] **Step 1: Write the failing test**

Append to `tests/test_cortex_daily.py`:

```python
class TestCanonicalSections(unittest.TestCase):
    def setUp(self):
        self.text = read("assets/canonical-sections.md")

    def test_default_sections_present(self):
        for s in [
            "Action Items", "Health Flags", "Follow-up", "Pipeline Summary",
            "Email Triage", "Task / PM Activity", "Meetings", "Calendar",
            "Active Project Status", "Inbox Residue", "Changelog",
        ]:
            self.assertIn(s, self.text, f"canonical menu missing: {s}")

    def test_youtube_not_in_default_menu(self):
        # YouTube may be mentioned as opt-in, but must be explicitly marked so.
        if "YouTube" in self.text:
            self.assertRegex(self.text, r"YouTube[\s\S]{0,120}(opt-in|explicit)")

    def test_connector_type_column_present(self):
        for t in ["email", "project-management", "transcript", "calendar"]:
            self.assertIn(t, self.text, f"missing connector type: {t}")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 tests/test_cortex_daily.py`
Expected: FAIL — `FileNotFoundError` for `assets/canonical-sections.md`.

- [ ] **Step 3: Write minimal implementation**

Create `skills/cortex-daily/assets/canonical-sections.md`:

```markdown
# Canonical Section Menu

Default starting point shown during the interview. Auto-filter to live connectors
before showing: drop any section whose required connector type is not connected.
User then keeps/drops/reorders/adds. Injection order in PART 5 = the user's chosen order.

| # | Section | Required connector type | Surfaces |
|---|---|---|---|
| 1 | Action Items | — | Carry-forward + all pulled signals, priority-ordered (red/amber/green checkboxes) |
| 2 | Health Flags | — | Project-hub discrepancy groups (stale blockers, slips) |
| 3 | Follow-up | — | Async questions Claude needs the user to answer |
| 4 | Pipeline Summary | — | Source table: what was pulled this run, per connector |
| 5 | Email Triage | email | Reply-needed and important unread, mapped to projects |
| 6 | Task / PM Activity | project-management | Overdue, upcoming, @mentions, reply-needed |
| 7 | Meetings | transcript/recording | New transcripts pulled and filed |
| 8 | Calendar | calendar | Today's agenda, prep flags |
| 9 | Active Project Status | — | Per-project status blocks from hubs |
| 10 | Inbox Residue | — | What landed in _Inbox/ unsorted this run |
| 11 | Changelog | — | What this run created/moved/updated |

## Silent / opt-in (never proposed)

- **YouTube Digest** — surfaced ONLY if the user explicitly asks to pull from YouTube.
  This is opt-in by explicit request; never include it by default.
  Recipe: read Research/ YouTube notes created since last run → dedup by topic →
  top-N takeaways. See `section-library.md`.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 tests/test_cortex_daily.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/cortex-daily/assets/canonical-sections.md tests/test_cortex_daily.py
git commit -m "feat(cortex-daily): add canonical section menu (YouTube opt-in)"
```

---

### Task 4: Section recipes — `assets/section-library.md`

**Files:**
- Create: `skills/cortex-daily/assets/section-library.md`
- Modify: `tests/test_cortex_daily.py` (add `TestSectionLibrary`)

**Interfaces:**
- Produces: `assets/section-library.md` with one recipe per canonical section, per connector type, a generic custom-section recipe, and the opt-in YouTube recipe. Each connector-reading recipe states it inherits the PART 2 dedup guard.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_cortex_daily.py`:

```python
class TestSectionLibrary(unittest.TestCase):
    def setUp(self):
        self.text = read("assets/section-library.md")

    def test_recipe_per_connector_type(self):
        for t in ["email", "project-management", "transcript", "calendar"]:
            self.assertIn(t, self.text, f"no recipe references connector type: {t}")

    def test_vault_internal_recipes_present(self):
        for s in ["Action Items", "Active Project Status", "Inbox Residue"]:
            self.assertIn(s, self.text)

    def test_has_generic_custom_recipe(self):
        self.assertRegex(self.text.lower(), r"custom section")

    def test_youtube_recipe_marked_opt_in(self):
        self.assertIn("YouTube", self.text)
        self.assertRegex(self.text, r"YouTube[\s\S]{0,160}(opt-in|explicit)")

    def test_connector_recipes_note_dedup_inheritance(self):
        low = self.text.lower()
        self.assertIn("dedup", low)
        self.assertIn("part 2", low)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 tests/test_cortex_daily.py`
Expected: FAIL — `FileNotFoundError` for `assets/section-library.md`.

- [ ] **Step 3: Write minimal implementation**

Create `skills/cortex-daily/assets/section-library.md`:

````markdown
# Section Library — Body Recipes

Each recipe is a template the generator composes into a concrete, vault-specific
instruction block. Fill the `<...>` slots from auto-detected vault state
(actual connector name, board→project map from memory.md, real folder paths).

Recipes are **connector-agnostic**: they key off connector TYPE, not a vendor.
The composed body names the actual detected tool. If two connectors of one type
are live, the body covers both.

> Every recipe that reads a connector INHERITS the PART 2 dedup guard. A section
> body must never bypass it: dedup runs before any note is created.

---

## Vault-internal sections (no connector)

### Action Items
Lead the briefing. Compile from: carried-forward unchecked items, new blockers,
deadlines, and reply-needed signals surfaced by other sections. Priority-order
red → amber → green as markdown checkboxes. Each line: `priority **<area> — <task>**
— <one-line context with where to act>`.

### Health Flags
Read each active project hub. Surface stale blockers, decision drift, and slips
as grouped bullets. If a health-tracker ledger exists, summarize its flags.

### Follow-up
List questions Claude needs answered to have full context next run. Leave a
clearly marked area for the user's reply. If none: "No questions today."

### Pipeline Summary
One table: per connector, how many items pulled / filed / skipped-as-dup this run.

### Active Project Status
Per active project: current stage, top blocker, last update. Pull from hubs.

### Inbox Residue
List everything that landed in _Inbox/ this run with the reason it couldn't be
auto-routed. This is the unattended-ambiguity escape hatch.

### Changelog
Summarize this run's _changelog.txt entries: created / moved / updated.

---

## Connector-typed sections

### Email Triage  (connector type: email — Gmail, Outlook, Proton, Fastmail, …)
Using the live email connector(s), surface: threads where someone replied and
awaits <user>; important unread since last run. Map each to a project via
memory.md routing signals. File project-tied emails per routing rules
(prefix `Email — `). Inherits PART 2 dedup (match on thread id).

### Task / PM Activity  (connector type: project-management — Monday, Asana, Trello, ClickUp, Jira, Linear, Basecamp, …)
Using the live PM connector(s), surface: items awaiting <user>'s reply; overdue
items assigned to <user>; items due within 3 days; @mentions since last run.
Map each item to its project using the board→project table in memory.md.
Skip items already actioned in yesterday's briefing.

### Meetings  (connector type: transcript/recording — Granola, Fathom, Otter, Fireflies, …)
Using the live transcript connector(s), pull new recordings since last run.
For each, run PART 2 dedup (match on granola_id/fathom_id, never filename), then
file as a meeting note in the correct project Notes/ or client Meetings/ folder,
threading prev/next if part of a series. Summarize each filed meeting in one line.

### Calendar  (connector type: calendar — Google Calendar, Outlook Calendar, …)
Using the live calendar connector(s), surface today's agenda and flag events
needing prep (no agenda, external attendees, tied to a blocked project).

---

## Custom section (generic recipe)

When the user defines a custom section, capture: name, what it reads (which
connector or vault location), what it surfaces. Compose a body of the form:
read <source> since last run → filter to <criteria> → summarize as <format>.
If the custom section needs a connector type that is NOT live, warn the user at
generate-time ("no connector for this; the section will no-op") and offer to drop
it or keep it as a manual-fill placeholder. Connector-reading custom sections
inherit the PART 2 dedup guard.

---

## YouTube Digest (OPT-IN ONLY — never propose)

Surface this recipe only when the user EXPLICITLY asks to pull from YouTube.
Recipe: read Research/ YouTube notes created since last run (use the `created`
frontmatter field) → group by topic, collapsing multi-channel coverage → select
top-N takeaways, one tight sentence each → link each to its vault note.
````

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 tests/test_cortex_daily.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/cortex-daily/assets/section-library.md tests/test_cortex_daily.py
git commit -m "feat(cortex-daily): add connector-agnostic section recipes"
```

---

### Task 5: Generator playbook — `workflows/generate-routine.md`

**Files:**
- Create: `skills/cortex-daily/workflows/generate-routine.md`
- Modify: `tests/test_cortex_daily.py` (add `TestWorkflow`)

**Interfaces:**
- Produces: `workflows/generate-routine.md` documenting the 7 runtime steps, connector-type detection, diff/refresh mode, the saved-file metadata header format, and the edge-case table.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_cortex_daily.py`:

```python
class TestWorkflow(unittest.TestCase):
    def setUp(self):
        self.text = read("workflows/generate-routine.md")
        self.low = self.text.lower()

    def test_seven_runtime_steps(self):
        for kw in ["resolve", "auto-detect", "confirm", "interview",
                   "assemble", "emit", "instruct"]:
            self.assertIn(kw, self.low, f"workflow missing step keyword: {kw}")

    def test_connector_type_detection(self):
        for t in ["email", "project-management", "transcript", "calendar"]:
            self.assertIn(t, self.text)

    def test_saved_copy_path_and_header(self):
        self.assertIn(".claude/cortex/daily-routine.md", self.text)
        self.assertRegex(self.low, r"metadata header")

    def test_diff_refresh_mode(self):
        self.assertIn("diff", self.low)
        self.assertRegex(self.low, r"preserv\w* .*section choices|prior section choices")

    def test_edge_cases_documented(self):
        for kw in ["no connectors", "personality.md", "missing"]:
            self.assertIn(kw, self.low, f"workflow missing edge case: {kw}")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 tests/test_cortex_daily.py`
Expected: FAIL — `FileNotFoundError` for `workflows/generate-routine.md`.

- [ ] **Step 3: Write minimal implementation**

Create `skills/cortex-daily/workflows/generate-routine.md`:

````markdown
# Workflow — Generate Daily Routine

The cortex-daily generator runs these steps interactively. Output: a fenced prompt
in chat + a saved copy at `.claude/cortex/daily-routine.md`.

## Step 1 — Resolve the vault
Use `find_project_by_cwd`; fall back to `~/.claude/cortex/config.json` → `vault_path`.
Never hardcode a path.

## Step 2 — Auto-detect inputs (no questions yet)
- `list_projects` → project names, bucket/client terms.
- Read `personality.md` → vocabulary, folder layout, sub_note_types, tone.
  If `personality.md` is MISSING: stop and route to `cortex-onboarding`.
- Probe the session for connected MCP tools. Classify each live connector by TYPE:
  - **email** — Gmail, Outlook, Proton, Fastmail, generic IMAP servers
  - **project-management** — Monday, Asana, Trello, ClickUp, Jira, Linear, Basecamp
  - **transcript/recording** — Granola, Fathom, Otter, Fireflies
  - **calendar** — Google Calendar, Outlook Calendar
  Use a name-heuristic + a known-server map; if a server is unrecognized, ask the
  user which type it is (this is the only auto-detect question allowed).
- If `.claude/cortex/daily-routine.md` exists → enter REFRESH/DIFF mode (Step 6b).

## Step 3 — Present inferred profile and confirm
Show: vault path, project count, detected connectors (by type + vendor), and the
canonical section menu auto-filtered to live connector types. Ask the user to
confirm/edit the connector list and choose a run-time (e.g. 7:00am).

## Step 4 — Custom-section interview
Show the auto-filtered canonical menu from `assets/canonical-sections.md`. The user:
1. keeps/drops sections,
2. reorders them (this is the PART 5 injection order),
3. adds custom sections (name + reads + surfaces) → map to the generic recipe.
Surface the YouTube section ONLY if the user explicitly asks for it.
For any chosen/custom section needing an absent connector type, warn and offer to
drop it or keep it as a manual placeholder.

## Step 5 — Assemble the output prompt
- Load `assets/routine-skeleton.md`.
- Fill slots: `<user>`, `<vault_path>`, `<connector_pull_list>` (one line per live
  connector), and `<YYYY-MM-DD>` left literal for the routine to fill at run-time.
- For each chosen section, pull its recipe from `assets/section-library.md`, compose
  a concrete body (real connector names, board→project map from memory.md, real
  folder paths), and inject all bodies — in the user's order — at the
  `<!-- INJECT: SECTION BODIES -->` marker.
- Do NOT edit any locked rail.

## Step 6 — Emit and save
- Print the full assembled prompt to chat inside a fenced block for clean copy.
- Write `.claude/cortex/daily-routine.md` with a **metadata header** then the prompt:

  ```
  ---
  generated: <YYYY-MM-DD>
  connectors: [<type:vendor>, ...]
  sections: [<section in chosen order>, ...]
  run_time: "<HH:MM>"
  ---
  <fenced prompt>
  ```
- `append_changelog` a CREATED (first run) or UPDATED (refresh) entry.

### Step 6b — Refresh / diff mode
When a saved `.claude/cortex/daily-routine.md` exists:
- Read its metadata header to recover the prior connectors + section choices.
- Re-detect current projects + connectors; compute the delta (e.g. "+2 projects,
  +Asana, −Fathom").
- Show the diff. PRESERVE the prior section choices; only apply the deltas
  (add sections for new connector types, drop sections whose connector vanished,
  refresh project lists in composed bodies).
- On confirm, rewrite the file and `append_changelog` UPDATED.

## Step 7 — Instruct the user
Tell the user: open Claude → create a new Routine → paste the prompt → schedule it
for the chosen run-time. Note that re-running `/cortex-daily` later refreshes it.

## Edge cases

| Case | Handling |
|---|---|
| No connectors live | Generate a briefing-only routine (vault-internal sections only). Note connector sections unlock when tools connect. |
| `personality.md` missing | Stop; route to `cortex-onboarding`. |
| Custom section needs an absent connector | Warn "no connector; will no-op"; offer drop or keep-as-manual. |
| Routine env lacks cortex-vault MCP | The skeleton already embeds literal fallbacks (manual file ops + changelog line format). |
| Two connectors of the same type | One section body covers both. |
| First run, no saved file | Full interview (no diff). |
| Unattended run hits true ambiguity | Routes to _Inbox/ + Inbox Residue (enforced by the skeleton). |
````

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 tests/test_cortex_daily.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills/cortex-daily/workflows/generate-routine.md tests/test_cortex_daily.py
git commit -m "feat(cortex-daily): add generator playbook workflow"
```

---

### Task 6: Wiring — trigger phrases + progressive-features handoff

**Files:**
- Modify: `references/trigger-phrases.md` (add a row for cortex-daily)
- Modify: `references/progressive-features.md` (daily_briefing handoff)
- Modify: `tests/test_cortex_daily.py` (add `TestWiring`)

**Interfaces:**
- Consumes: `read_repo()` helper from Task 1.
- Produces: a trigger-phrases row referencing `cortex-daily`; a progressive-features note that the `daily_briefing` activation hands off to `cortex-daily`.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_cortex_daily.py`:

```python
class TestWiring(unittest.TestCase):
    def test_trigger_phrases_lists_cortex_daily(self):
        self.assertIn("cortex-daily", read_repo("references/trigger-phrases.md"))

    def test_progressive_features_handoff(self):
        text = read_repo("references/progressive-features.md")
        self.assertIn("cortex-daily", text)
        # handoff must be associated with the daily_briefing feature
        self.assertRegex(text, r"daily_briefing[\s\S]{0,400}cortex-daily")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 tests/test_cortex_daily.py`
Expected: FAIL — `TestWiring` assertions (no `cortex-daily` in either reference file).

- [ ] **Step 3: Write minimal implementation**

First, inspect the existing trigger table to match its column shape:

Run: `grep -n "row 21\|^| *21\|cortex-extend" references/trigger-phrases.md | head`

Add a new row to the trigger table in `references/trigger-phrases.md` (use the next free row number; match the existing column layout — the example below uses the same columns as the cortex-extend row):

```markdown
| 22 | cortex-daily | "set up my daily routine", "build my daily briefing", "create a daily pipeline", "/cortex-daily", "generate my morning routine" | Generator: emits a copy-paste Claude Routine prompt for the unattended daily pipeline |
```

Then, in `references/progressive-features.md`, locate the `daily_briefing` dormant-feature block and add a handoff note immediately after its `activation_prompt`. Add this line within that feature's documentation:

```markdown
      # On "yes", hand off to the cortex-daily skill, which generates the
      # routine prompt. The activation does not build the routine itself.
      handoff_skill: "cortex-daily"
```

Also add, in the prose section of `progressive-features.md` that describes activation handling, the sentence:

```markdown
When the user accepts the `daily_briefing` activation offer, route to `cortex-daily`
to generate the routine prompt rather than producing a one-off briefing.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 tests/test_cortex_daily.py`
Expected: PASS (all classes).

- [ ] **Step 5: Commit**

```bash
git add references/trigger-phrases.md references/progressive-features.md tests/test_cortex_daily.py
git commit -m "feat(cortex-daily): wire triggers + daily_briefing activation handoff"
```

---

### Task 7: Behavioral scenarios + docs

**Files:**
- Modify: `tests/scenarios.md` (add cortex-daily scenarios)
- Modify: `README.md` (add cortex-daily to the skills list)
- Modify: `CHANGELOG.md` (add entry)
- Modify: `tests/test_cortex_daily.py` (add `TestScenariosDoc`)

**Interfaces:**
- Consumes: `read_repo()` helper.
- Produces: human-runnable scenarios for first-run generate, refresh/diff, no-connector, and missing-personality routing; README + CHANGELOG updates.

- [ ] **Step 1: Write the failing test**

Append to `tests/test_cortex_daily.py`:

```python
class TestScenariosDoc(unittest.TestCase):
    def test_scenarios_cover_cortex_daily(self):
        text = read_repo("tests/scenarios.md")
        self.assertIn("cortex-daily", text)
        low = text.lower()
        self.assertIn("refresh", low)
        self.assertIn("no connector", low)

    def test_readme_lists_skill(self):
        self.assertIn("cortex-daily", read_repo("README.md"))

    def test_changelog_mentions_skill(self):
        self.assertIn("cortex-daily", read_repo("CHANGELOG.md"))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 tests/test_cortex_daily.py`
Expected: FAIL — `TestScenariosDoc` (no mentions yet).

- [ ] **Step 3: Write minimal implementation**

Append to `tests/scenarios.md` (after the last existing scenario; match the file's scenario format — Pre-conditions / Input / Expected routing / Expected behavior / Expected mutations / Expected chat output / Failure mode):

```markdown
---

## Scenario 11 — "set up my daily routine" → cortex-daily generates a prompt

**Pre-conditions:** Baseline vault. At least two connectors live (e.g. one email
type + one project-management type). No `.claude/cortex/daily-routine.md` yet.

**Input:** "set up my daily routine"

**Expected routing:** cortex-daily.

**Expected behavior:** Auto-detects vault, projects, and the two connectors by
type. Presents the inferred profile + auto-filtered canonical menu. Runs the
section interview. Assembles the prompt from the locked skeleton + composed bodies.

**Expected mutations:** Creates `.claude/cortex/daily-routine.md` (metadata header +
fenced prompt). Appends a CREATED entry to `_changelog.txt`. No other vault writes.

**Expected chat output:** The full fenced prompt + an instruction to paste it into a
new Claude Routine at the chosen time.

**Failure mode to exercise:** Remove `personality.md` → cortex-daily stops and routes
to cortex-onboarding instead of generating.

---

## Scenario 12 — re-run refreshes via diff

**Pre-conditions:** Baseline vault. `.claude/cortex/daily-routine.md` exists from
Scenario 11. One new project added; one connector removed since.

**Input:** "/cortex-daily"

**Expected routing:** cortex-daily (refresh/diff mode).

**Expected behavior:** Reads the saved metadata header, computes the delta, shows
"+1 project, −<connector>", PRESERVES prior section choices, applies only deltas.

**Expected mutations:** Rewrites `.claude/cortex/daily-routine.md`; appends an
UPDATED entry to `_changelog.txt`.

**Expected chat output:** The diff summary + the refreshed fenced prompt.

**Failure mode to exercise:** No connectors live → generates a briefing-only routine
(vault-internal sections only) and notes connector sections unlock later.
```

Add `cortex-daily` to the skills list in `README.md`. First find the list:

Run: `grep -n "cortex-extend\|cortex-coach\|## Skills\|### Skills" README.md | head`

Add a bullet matching the existing list style, for example:

```markdown
- **cortex-daily** — Generates a copy-paste Claude Routine prompt for an unattended daily pipeline: pull from all live connectors, dedup, file into the vault, and assemble a stepped briefing.
```

Add a `CHANGELOG.md` entry at the top of the unreleased/next-version section (match existing changelog style):

```markdown
- **cortex-daily skill** — New generator skill that emits a tailored, copy-paste prompt for a Claude Routine running the unattended daily pipeline (connector pull → dedup → file → stepped briefing). Connector-agnostic, fully customizable sections, chat + saved copy with diff-based refresh. Wired into the dormant `daily_briefing` activation.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 tests/test_cortex_daily.py`
Expected: PASS (every test class).

- [ ] **Step 5: Run the full repo test suite to confirm no regressions**

Run: `python3 tests/test_cortex_daily.py && python3 tests/test_activation.py && python3 tests/test_boot_budget.py`
Expected: All PASS.

- [ ] **Step 6: Commit**

```bash
git add tests/scenarios.md README.md CHANGELOG.md tests/test_cortex_daily.py
git commit -m "docs(cortex-daily): add behavioral scenarios + README/CHANGELOG entries"
```

---

## Self-Review

**Spec coverage** (each spec section → task):
- Architecture / file layout → Tasks 1–5 (SKILL, skeleton, canonical, library, workflow).
- Generator runtime (7 steps) → Task 5.
- Locked skeleton (PART 0–6, dedup, autonomy) → Task 2.
- Composed section bodies + canonical menu → Tasks 3, 4.
- Connector-agnostic recipes → Task 4.
- YouTube opt-in → Tasks 3, 4.
- Persistence + diff refresh → Task 5 (Step 6/6b).
- Progressive-features wiring → Task 6.
- Edge cases → Task 5 (table) + Task 7 (scenarios).
- Success criteria → covered by Scenarios 11–12 + structural tests.

**Placeholder scan:** All `<...>` tokens are intentional skeleton/template slots, defined in the workflow's slot-filling step (Task 5, Step 3). No "TBD/TODO/implement later." Each code/markdown step contains the actual content.

**Type consistency:** Test helpers `read()` / `read_repo()` defined in Task 1, used consistently. Asset filenames consistent across SKILL.md, workflow, and tests: `routine-skeleton.md`, `canonical-sections.md`, `section-library.md`, `generate-routine.md`. Injection marker `<!-- INJECT: SECTION BODIES -->` identical in skeleton (Task 2) and workflow (Task 5). Connector type tokens (`email`, `project-management`, `transcript`, `calendar`) identical across canonical, library, workflow, and their tests.

Note: trigger row number (`22`) and exact README/CHANGELOG anchor lines depend on current file state — Task 6/7 steps include a `grep` to locate the real insertion point before editing, so the implementer adapts to actual line context rather than a hardcoded position.

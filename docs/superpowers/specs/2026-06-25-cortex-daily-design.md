# cortex-daily — Design Spec

**Date:** 2026-06-25
**Status:** Approved (brainstorming) — pending implementation plan
**Target:** Cortex core plugin (`claude-cortex`), v1.4.x line
**Author:** Ben Hungerford + Claude

---

## Problem

Cortex advertises a `daily_briefing` feature (onboarding pain-point mapping, progressive-features dormant flag, activation prompt) but ships **no executable skill** behind it. Same for `email_triage` and `task_sync` — they are feature flags with descriptions, not implementations. A new Cortex user who wants a hands-off "pull from all my connectors every morning, sort everything into the right Obsidian folders, and hand me a briefing" has no built-in path to create one.

Separately, Claude (desktop/web) now has **Routines** — scheduled, recurring prompt runs. A Routine runs unattended in the user's Claude environment with their connected MCP tools and the Cortex plugin loaded. This is the natural execution surface for a daily pipeline. What's missing is a way to *generate the prompt* a user pastes into a new Routine — tailored to their vault, their connectors, and following a proven stepped framework.

## Goal

A core Cortex skill, `cortex-daily`, that **generates a tailored, copy-paste prompt** for a Claude Routine. The generated prompt, when run daily and unattended, executes the full pipeline:

> pull from all live connectors → dedup → route/file into the correct vault folders → assemble a stepped daily briefing → write it + log everything.

The skill is a **generator**, not a runner. It emits the prompt; Claude Routines schedules and runs it.

## Non-goals (YAGNI)

- Does **not** schedule the routine (Claude Routines owns scheduling; the skill emits + instructs).
- Does **not** run the briefing inline (generator only; "run it now to test" is a possible v2).
- Does **not** modify `personality.md` or `memory.md`.
- Does **not** duplicate Cortex core behavior (changelog logging, boot sequence) — reuses MCP tools.

---

## Key decisions (from brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | How the prompt content is tailored | **Auto-detect, then confirm** — read `personality.md`, project list, live MCP connectors; show inferred profile; user confirms/tweaks |
| 2 | Section framework | **Fully custom** — canonical set offered as a starting menu; user keeps/drops/reorders/adds |
| 3 | Output artifact | **Chat + saved copy** — print fenced prompt to chat AND save `.claude/cortex/daily-routine.md` |
| 4 | Unattended autonomy | **Full autonomous filing** — file confident items, ambiguous → `_Inbox/`, dedup guard, never delete/overwrite/duplicate |
| 5 | Skill home | **Cortex core plugin** — `skills/cortex-daily/`, wired into progressive-features activation |
| 6 | Generator architecture | **Skeleton + composed bodies (Approach C)** — locked rails + Claude-composed section bodies |
| 7 | YouTube section | **Silent / opt-in** — never proposed; surfaced only if user explicitly asks to pull from YouTube |
| 8 | Connector assumptions | **Connector-agnostic** — sections key off detected connector *type*, not a specific vendor |
| 9 | Refresh behavior | **Diff + confirm** — detect deltas vs saved copy, preserve prior section choices, apply deltas on confirm |

---

## Architecture

### File layout (in Cortex core plugin)

```
claude-cortex/skills/cortex-daily/
├── SKILL.md                      # triggers, MCP prefs, procedure (points to workflow)
├── workflows/
│   └── generate-routine.md       # the full generator playbook
├── assets/
│   ├── routine-skeleton.md       # the LOCKED rails of the output prompt
│   ├── canonical-sections.md     # default section menu (starting point)
│   └── section-library.md        # per-section body recipes
└── references/
    └── (new row added to core references/trigger-phrases.md)
```

Run output → vault:
- `.claude/cortex/daily-routine.md` — saved copy (metadata header + fenced prompt)
- chat — fenced prompt for copy-paste

### Two artifacts, clearly separated

1. **The generator** (`cortex-daily` skill) — runs interactively when the user asks. Inspects vault + connectors, interviews for custom sections, assembles and emits the prompt.
2. **The output prompt** — a self-contained markdown instruction block. Pasted into a Claude Routine. Runs unattended daily. Built from a locked skeleton + composed section bodies.

---

## Generator runtime

The skill, when invoked, runs `workflows/generate-routine.md`:

1. **Resolve vault** — `find_project_by_cwd` / `~/.claude/cortex/config.json` → `vault_path`. Never hardcode.
2. **Auto-detect inputs** (no questions yet):
   - `list_projects` → project names, bucket/client terms
   - read `personality.md` → vocabulary, folder layout, `sub_note_types`, tone
   - probe session for connected MCP tools → which connectors are live, grouped by **type** (email, project-management, transcript/recording, calendar, …)
   - read existing `.claude/cortex/daily-routine.md` if present → refresh/diff mode
3. **Present inferred profile + confirm** — vault, project count, detected connectors, proposed (auto-filtered) section menu. User confirms/edits connectors and run-time.
4. **Custom-section interview** — canonical menu shown auto-filtered to live connectors. User keeps/drops/reorders/adds custom sections. YouTube only appears if the user explicitly asks for it.
5. **Assemble** — fill `routine-skeleton.md` rails; inject composed section bodies in the user's chosen order.
6. **Emit** — print full prompt to chat (fenced); write `.claude/cortex/daily-routine.md`; `append_changelog` (CREATED or UPDATED).
7. **Instruct** — short note: "paste into a new Claude Routine, schedule for <time>."

### Triggers

- Literal: "set up my daily routine", "build my daily briefing", "create a daily pipeline", `/cortex-daily`
- Handoff: progressive-features `daily_briefing` activation offer → on "yes" routes here.

---

## The output prompt: locked skeleton (Approach C)

These rails are **non-customizable**. They are what make the routine safe to run unattended. Parts 3 and 5 hold the flex (which connectors, which sections); everything else is locked.

```
PART 0: IDENTITY & MODE  (locked)
  You are running an UNATTENDED daily Cortex pipeline for <user>.
  Vault: <vault_path>. No human is present — never pause to ask a question.
  Questions for the user go in the briefing's Follow-up section, not the chat.

PART 1: BOOT  (locked)
  - Read personality.md, the vault rule files (CLAUDE.md / .claude/rules), memory.md
  - Read the last 50 lines of _changelog.txt
  - Read yesterday's briefing → carry forward unchecked critical (🔴) items;
    pick up answers the user left in the Follow-up section

PART 2: DEDUP GUARD  (locked, MANDATORY)
  For every pulled item, BEFORE creating anything:
    a. Cursor check against _pipeline_state.json (*.last_processed_ids)
    b. Vault grep on the source ID (granola_id / fathom_id / thread id / …) —
       MATCH ON THE ID, NEVER THE FILENAME (curated notes get renamed)
  Already present → skip, or merge only genuinely new detail into the existing note.
  Append new IDs to the matching cursor after filing.

PART 3: PULL  (per live connector; the pull→dedup→route loop is locked)
  For each detected connector, fetch items since last run → dedup (Part 2) → route (Part 4).

PART 4: ROUTE & FILE  (locked autonomy rules)
  - Confidently routed (matches an auto-routing signal / clear project tie):
      file into the folder, add frontmatter (quoted tags), [[_MOC]] footer,
      update the folder's _MOC, append_changelog
  - Ambiguous → _Inbox/, flag in Inbox Residue
  - NEVER delete. NEVER overwrite silently. NEVER duplicate.

PART 5: ASSEMBLE BRIEFING  (← user's custom section bodies injected here, in order)

PART 6: WRITE & LOG  (locked)
  - Write Daily Briefings/YYYY-MM-DD.md (frontmatter type: daily-briefing)
  - append_changelog (CREATED)
  - Stop. Do not message the user; the briefing IS the output.
```

**Locked guarantees regardless of customization:** dedup guard, ambiguous→`_Inbox/`, log every write, never delete/overwrite/duplicate, no mid-run questions. Any section in Part 5 that reads a connector inherits the Part 2 dedup guard automatically — a custom section cannot bypass it.

---

## The output prompt: composed section bodies (Part 5)

### Canonical menu (default starting point)

Shown auto-filtered to live connectors. YouTube is **excluded** from the default menu (opt-in only).

| Section | Reads | Connector type required | Surfaces |
|---|---|---|---|
| Action Items | carry-forward + all pulled signals | — | 🔴/🟡/🟢 checkboxes, priority-ordered |
| Health Flags | project hubs / health data | — | discrepancy groups |
| Follow-up | Claude's open questions | — | async questions for the user |
| Pipeline Summary | this run's pull counts | — | source table |
| Email Triage | email connector | email | reply-needed, important unread |
| Task / PM Activity | project-management connector | project-management | overdue, upcoming, mentions, reply-needed |
| Meetings | transcript/recording connector | transcript/recording | new transcripts pulled + filed |
| Calendar | calendar connector | calendar | today's agenda, prep flags |
| Active Project Status | project hubs | — | per-project status blocks |
| Inbox Residue | `_Inbox/` | — | what landed unsorted this run |
| Changelog | this run's ops | — | what changed |

**Silent/opt-in:** YouTube Digest — only surfaced if the user explicitly asks ("pull from YouTube"). Recipe: read `Research/` YouTube notes created since last run → dedup by topic → top-N takeaways.

### Connector-agnostic recipes

Sections key off connector **type**, never a hardcoded vendor. The composed body names the *actual* detected tool at generate-time.

| Generic section | Fires when any connector of type… is live | Example vendors |
|---|---|---|
| Email Triage | email | Gmail, Outlook, Proton, Fastmail |
| Task / PM Activity | project-management | Monday, Asana, Trello, ClickUp, Jira, Linear, Basecamp |
| Meetings | transcript/recording | Granola, Fathom, Otter, Fireflies |
| Calendar | calendar | Google Calendar, Outlook Calendar |

If two connectors of one type are live, the section body covers both.

### Interview mechanics (during confirm step)

1. **Auto-filter** — drop any canonical section whose required connector type isn't live.
2. **Keep/drop** — user trims the remaining menu.
3. **Reorder** — user numbers sections; that order is the Part 5 injection order.
4. **Add custom** — free text: section name + what it reads + what it surfaces. Skill maps it to a generic recipe (read source → filter → summarize). If it needs an absent connector → warn "no connector; will no-op," offer drop or keep-as-manual.

### How a body is composed

Each chosen section pulls its recipe from `section-library.md` and the skill composes a concrete, vault-specific instruction block (actual connector name, actual board→project mapping from `memory.md`, actual folder paths).

---

## Persistence & refresh

- **Saved copy:** `.claude/cortex/daily-routine.md` — a metadata header (generated date, detected connectors, chosen sections + order, run-time) followed by the fenced prompt.
- **Refresh = diff mode:** re-running reads the saved file, re-detects projects + connectors, shows a delta ("+2 projects, +Asana, −Fathom"), **preserves prior section choices**, applies only deltas on confirm, rewrites the file, `append_changelog` (UPDATED).
- The metadata header is what makes diffing possible — it records the prior choice set.

---

## Progressive-features wiring

- The dormant `daily_briefing` activation prompt ("You have N active projects with open blockers — want a daily briefing each morning?") on **"yes" hands off to `cortex-daily`** instead of dead-ending.
- Add `cortex-daily` to `references/trigger-phrases.md` and reference it as the handoff target in `references/progressive-features.md`.
- **Activation level:** generating + saving is explicit user intent (L2+). At L1, the skill still generates but warns before writing the saved file.

---

## Error handling & edge cases

| Case | Handling |
|---|---|
| No connectors live | Generate a briefing-only routine (vault-internal sections: Action Items, Health Flags, Follow-up, Active Project Status, Inbox Residue, Changelog). Note that connector sections unlock when tools connect. |
| `personality.md` missing | User hasn't onboarded — stop, route to `cortex-onboarding` first. |
| Custom section needs an absent connector | Warn "no connector; will no-op" → offer drop or keep-as-manual. |
| Routine env lacks Cortex MCP (Desktop without server) | Skeleton includes literal fallback instructions (manual file ops + the changelog line format) so the routine still runs without MCP tools. |
| Two connectors of the same type | One section body covers both. |
| First run, no saved file | Full interview (no diff). |
| Unattended run hits true ambiguity | → `_Inbox/` + Inbox Residue flag. Never guess, never block. |

---

## MCP tools used (generator)

Prefer `cortex-vault` MCP tools over manual file ops:

- `find_project_by_cwd` / config.json → resolve vault path
- `list_projects` → project + bucket enumeration
- `append_changelog` → log the generate/refresh op
- (read) `personality.md`, `memory.md`, `_pipeline_state.json` for context

The **output prompt** instructs the routine to use the full `cortex-vault` toolset at run-time (`read_hub`, `update_moc`, `append_changelog`, `thread_meeting`, `validate_frontmatter`, `open_question`, …), with literal fallbacks baked in.

---

## Open questions for implementation plan

- Exact recipe format in `section-library.md` (template variables, how the composer fills them).
- Connector-type detection: how to reliably classify a live MCP server as email / PM / transcript / calendar (name heuristics + a small known-server map).
- Diff presentation format for refresh mode.
- Whether the run-time output prompt should embed the user's full rule files inline or instruct the routine to read them from the vault (size vs. self-containment trade-off).

---

## Success criteria

1. A new Cortex user with ≥1 connector can run `cortex-daily`, answer a short interview, and receive a copy-paste prompt.
2. Pasting that prompt into a Claude Routine and scheduling it produces, each day, a correctly-filed vault + a briefing in `Daily Briefings/` following the stepped framework.
3. Daily re-runs do **not** create duplicate notes (dedup guard holds).
4. Ambiguous items land in `_Inbox/` and are surfaced, never misfiled.
5. Re-running `cortex-daily` after adding a project/connector updates the saved prompt via diff without losing the user's section choices.
6. Works vendor-agnostically — a user on Outlook + Asana gets correct bodies without code changes.

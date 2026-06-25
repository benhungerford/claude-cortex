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
Skip items already actioned in yesterday's briefing. Inherits PART 2 dedup.

### Meetings  (connector type: transcript/recording — Granola, Fathom, Otter, Fireflies, …)
Using the live transcript connector(s), pull new recordings since last run.
For each, run PART 2 dedup (match on granola_id/fathom_id, never filename), then
file as a meeting note in the correct project Notes/ or client Meetings/ folder,
threading prev/next if part of a series. Summarize each filed meeting in one line.
Inherits PART 2 dedup.

### Calendar  (connector type: calendar — Google Calendar, Outlook Calendar, …)
Using the live calendar connector(s), surface today's agenda and flag events
needing prep (no agenda, external attendees, tied to a blocked project).
Inherits PART 2 dedup.

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

## YouTube Digest (opt-in only — never propose)

Surface this recipe only when the user EXPLICITLY asks to pull from YouTube.
Recipe: read Research/ YouTube notes created since last run (use the `created`
frontmatter field) → group by topic, collapsing multi-channel coverage → select
top-N takeaways, one tight sentence each → link each to its vault note.

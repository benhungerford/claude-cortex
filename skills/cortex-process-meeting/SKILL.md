---
name: cortex-process-meeting
description: Turns a meeting transcript, Granola/Fathom export, email recap, or pasted notes into a threaded meeting note in the right project Notes/ folder (or client Meetings/ folder for non-project meetings). Handles series threading, frontmatter, and MOC updates, and hands decisions and blockers to cortex-update-context. Fires on a pasted transcript, "process this meeting", or when a Granola/Fathom tool returns a transcript.
---

# cortex-process-meeting

File a meeting as a vault note and push its decisions and blockers into the project. This skill extracts; `cortex-update-context` writes to the hub and Changelog. The step-by-step procedure is in `workflows/process-meeting.md`.

## When it fires

- Phrases: "process this meeting", "here are the notes from X", "meeting notes:", "from my call with X", "file this meeting".
- A pasted transcript with speaker labels. A timestamped one is filed directly; one without timestamps gets a quick "file this as a meeting, or keep it as context?"
- A Granola or Fathom tool returns a transcript this turn.

## Tools

Cortex MCP tools are named `mcp__plugin_claude-cortex_cortex-vault__<tool>`. Use `thread_meeting`, `update_moc`, `append_changelog`, and `validate_frontmatter`. Without the server, do the same steps by hand.

## Rules

**Routing.** The vault's `.claude/rules/routing-rules.md` (meeting section) decides where a meeting goes; follow it when it exists. The core test: is the main subject the scoped work of one project (wireframe review, sprint planning, dev handoff, QA)? Then the project's `Notes/`. Is it about the client relationship, brand, marketing, distribution, or ops? Then the client's `Meetings/`. No client tie at all goes to `Work/Meetings/` (or the vault's equivalent). Lean toward client-level: a status call that mentions the project once is still a client call.

**Two projects in one meeting.** File under the main one, add `*Related:*` links both ways to the other, and send each project's decisions to its own hub.

**Duplicates.** For Granola or Fathom input, search the vault for the source ID (`granola_id: <id>`, `fathom_id: <id>`) before creating a note. If a note already has it, update that note instead. Match on the ID, not the filename, because filed notes get renamed.

**Threading** follows the vault's `.claude/rules/meeting-threading.md`: a series is 3+ notes in the same folder sharing the title after the date. Link the new note to the most recent existing one (even across a skipped week) with `*Previous:*`/`*Next:*`, keeping any `*Related:*` line. Cross-project meetings get `*Related:*`, not thread links.

**Handoff.** Send all extracted decisions, blockers, and scope changes to `cortex-update-context` in one batch, so the user sees one confirmation. If someone changed their mind mid-meeting, send only the final decision and note the pivot in the meeting note. Action items stay in the meeting note.

**Ask once** if the project is unclear ("Which project does this meeting belong to?"), or the client for a client-level meeting.

**Note shape.** Open with a `> [!summary]` callout (collapsed `> [!summary]-` past 4 lines). Summarize long transcripts into sections rather than pasting them; the source ID in frontmatter points back to the original. Other syntax: `references/obsidian-syntax.md`.

## Missing folders

- New client: create the client folder (`_MOC.md`, `<Client> — Client Context.md` stub, `Meetings/`) as part of filing.
- New project: hand off to `cortex-ingest-project` first, then file.

## Closing check

Before you report done:

1. Run `validate_frontmatter` on the new meeting note and on every note you edited (the previous note in the series, hubs).
2. Confirm the folder's `_MOC.md` lists the note as `[[<exact filename without .md>]]`, and that any `*Previous:*` link names a file that exists.
3. Show the result in one short table: file, frontmatter valid, MOC entry.

If a check fails, fix it and run the check again. Then announce, e.g. `Filed 2026-04-08 FKT Standup, threaded after 2026-04-01; 2 decisions sent to the hub.` Say `(first in this series)` or `No decisions or blockers found` when that's the case.

---
name: cortex-update-context
description: The main write path into a project's vault files. Routes decisions, scope changes, new or resolved blockers, and client preferences to the right file (Project Context hub, sub-note, or Changelog.md), logs each write, and stops to ask when new information contradicts what is written. Fires on "log that", "we decided", "new blocker", "that's resolved", or a Tier 1 capture from the session's capture rules.
---

# cortex-update-context

Write a decision, blocker, or scope change from the conversation into the right vault file. `cortex-process-meeting` and `cortex-knowledge` hand their project writes to this skill. The step-by-step procedure is in `workflows/update-context.md`.

## When it fires

- Explicit phrases: "log that/this/it", "add this to <project>", "we decided", "decision:", "I'm going with", "we're using", "new blocker", "blocked by", "that's resolved", "unblocked".
- Ambient Tier 1 captures, as defined in `references/capture-rules.md`. At L3, an inferred capture (no explicit phrase) gets a one-line confirm first, such as `Log that the wholesale portal moved to phase 2 for FKT? (y)`. Explicit phrases never need the confirm. See `references/activation-levels.md`.

## Tools

Cortex MCP tools are named `mcp__plugin_claude-cortex_cortex-vault__<tool>`. Use `open_question` (add or resolve hub rows), `append_changelog`, `update_moc`, and `validate_frontmatter`. Without the MCP server, edit the files directly and follow the same rules.

## Routing

| Change | Primary file | Also |
|---|---|---|
| Scope, strategy, or direction decision | Hub (`<Project> — Project Context.md`) | Changelog.md |
| New blocker or open question | Hub, Open Questions & Blockers table | Changelog.md |
| Blocker resolved | Hub: remove the row | Changelog.md records the resolution |
| Technical or design decision | The matching sub-note from `personality.md` `sub_note_types` (e.g. Tech Stack & Architecture, Design System) | Hub if material, Changelog.md |
| Status or stage change | Hub, Stage Tracker | Changelog.md |
| Client preference | Hub, Contacts or Overview | Changelog.md |
| New resource or link | Relevant sub-note | `_changelog.txt` only |
| New sub-note | The new file | `_MOC.md`, hub Quick Links |

Every write also gets a `_changelog.txt` line, in the format the vault's `.claude/rules/changelog-format.md` sets (use `append_changelog`).

## Rules

**Conflicts.** Before writing, compare the new information with what the target file says. If it contradicts it, stop and show the user what the new information says, what the file says, and the file path. Write only after they choose. When the new decision wins, the Changelog entry names what it replaced, e.g. `Switched from Braintree to Stripe; supersedes the 2026-03-15 decision.` If a hub Quick Links title shares keywords with the decision, read that sub-note too, because the contradiction may live there.

**Resolved blockers are removed, not struck through.** Delete the row from the hub table (`open_question` with `action: resolve` does this), renumber if the rows are numbered, and record the resolution in the Changelog. The Changelog is the permanent record; the hub table stays short.

**Read only what you will change.** Logging a decision to the hub means reading the hub and Changelog, not every sub-note.

**Bump `updated:`** on every file you modify. If the frontmatter won't parse, make the content change and tell the user the YAML needs fixing.

**Block IDs.** Decisions in the hub's `## Key Decisions` get a `^dec-YYYY-MM-DD-n` block ID, and the Changelog entry links to it as `[[<Project> — Project Context#^dec-YYYY-MM-DD-n]]`. Other Obsidian syntax rules are in `references/obsidian-syntax.md`; the Open Questions table format never changes (`references/hub-schema.md`).

## When something is unclear

- Project unclear: ask once which project, then write.
- "Log that" with an unclear "that": ask which part.
- Target file missing: offer to scaffold it; don't create it unasked.
- Resolved blocker not in the table: ask whether to log the resolution in the Changelog only.
- Project doesn't exist: hand off to `cortex-ingest-project`.
- A write fails partway: undo the writes from this run, log the rollback, and say so.

## Closing check

Before you report done:

1. Run `validate_frontmatter` on every note you created or edited.
2. For each new note, confirm its folder's `_MOC.md` lists it as `[[<exact filename without .md>]]`.
3. Show the result in one short table: file, frontmatter valid, MOC entry.

If a check fails, fix it and run the check again. Then announce in one line which files changed, e.g. `Updated FKT: cart moved to Rebuy in Tech Stack; logged to Changelog.`

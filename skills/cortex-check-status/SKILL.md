---
name: cortex-check-status
description: Read-only project status lookups. Reads a project's Context hub and Changelog.md to answer "what's the status of X", "where are we on Y", "what's blocking Z", "what's left on the project", or "any open questions". Gives the stage, active blockers, and recent decisions in 2-5 sentences with file citations. Never writes to the vault.
---

# cortex-check-status

Answer status questions from the vault, not from memory or guesses, and cite the files the answer came from. The step-by-step procedure is in `workflows/check-status.md`.

## When it fires

"What's the status of X", "where are we on X", "what's left on X", "what's blocking X", "any open questions on X", "is X on track", "catch me up on X", where X fuzzy-matches a known project.

## Tools

Cortex MCP tools are named `mcp__plugin_claude-cortex_cortex-vault__<tool>`. Use `read_hub` for the parsed hub and `list_projects` to find the project. Without the server, read the files directly.

## Rules

- Read only. If the user follows up with a change ("that blocker's resolved"), hand off to `cortex-update-context`.
- Read the hub and `Changelog.md` by default. Read a sub-note only when the question is about its area ("what PHP version is FKT on?" reads Tech Stack).
- Match names generously: "FKT", "Frankl and Thomas", and "the FKT shopify build" are one project. If several projects match, list them numbered, ask once, then answer.
- Keep it to 2-5 sentences: stage, open blockers, the last 2-3 decisions with dates. Then point out what needs attention: a blocker on the critical path, a stale blocker (no movement in a while), a question open a long time, a dependency for the next phase. Report what the files say; leave conclusions to the user.
- End with the sources, e.g. `Sources: Project Context hub, Changelog (last 3 entries).`

## Edge cases

- No match: "I don't see a project called X. Did you mean Y, or is this a new project?" Don't scaffold it yourself.
- Project folder without a hub: say so and offer to scaffold the hub.
- Malformed YAML: name the line and answer from what parses.
- No `Changelog.md`: answer from the hub and say the Changelog is missing.
- No project named: list the 3 most recently updated active projects and ask which.
- Archived project: say it's archived and offer the last known status.

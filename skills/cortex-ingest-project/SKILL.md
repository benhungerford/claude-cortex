---
name: cortex-ingest-project
description: Scaffolds a new project inside an existing vault from raw input (a brief, transcript, email, SOW, brain dump, or just a project name). Creates the project folder — _MOC, the Project Context hub, sub-notes from personality.md's sub_note_types, Changelog.md, and Notes/ — and updates the parent MOC. Fires on "new project", "start tracking X", "scaffold a project for Y", or a pasted project brief.
---

# cortex-ingest-project

Take a new project from nothing to a filed vault entry in one pass, using the user's own vocabulary from `personality.md`. The step-by-step procedure is in `workflows/ingest-project.md`.

## When it fires

- Phrases: "new project", "I'm starting a new <project_term>", "start tracking X", "scaffold/set up a project for X", "add X as a project".
- A pasted brief, SOW, or kickoff email (5+ lines of prose about goals, deadlines, or stakeholders) that matches no existing project. If unsure, ask: "Is this a new project or an update to <X>?"

If `personality.md` is missing, hand off to `cortex-onboarding`.

## Tools

Cortex MCP tools are named `mcp__plugin_claude-cortex_cortex-vault__<tool>`. Use `scaffold_project` (creates the client folder if needed, plus the project files), `update_moc`, `append_changelog`, and `validate_frontmatter`. Without the server, create the files by hand from `assets/blank-template.md`.

## Rules

**Use the user's words.** Folder names come from `mental_model.bucket_term`; sub-notes come from the target bucket's `sub_notes` in `personality.md`. Don't fall back to Shopify-style defaults when the user's vault says otherwise. If the bucket lists no sub-notes, create only `_MOC.md`, the hub, `Changelog.md`, and `Notes/`.

**Ask at most 3 questions,** about scope and dependency readiness (access, approvals, what's in launch). Anything still unknown goes into the hub as an Open Question.

**Create every sub-note, even empty.** A stub with section headings is better than a missing file; later sessions fill it in.

**Don't overwrite an existing project.** If the name already exists in the target bucket, say `Project already exists — updating instead of scaffolding.` and hand the input to `cortex-update-context`. A new project beside an existing one for the same client (e.g. "FKT checkout" next to "Shopify Website Build") is not a collision.

**Brief content.** A pasted brief keeps its structure in the hub Overview; key facts become frontmatter properties; any decision already in the brief goes into `## Key Decisions` with a `^dec-YYYY-MM-DD-n` block ID (see `references/obsidian-syntax.md`).

**Names that aren't filesystem-safe:** slugify the folder name, keep the original as the hub's `project:` value and H1.

Folder layout, required project files, and frontmatter follow the vault's own `.claude/rules/vault-structure.md` and `frontmatter-and-tags.md` when the vault has them; otherwise `references/vault-conventions.md`.

## When something is unclear

- No client given and the bucket needs one: ask "Which client is this under?"
- Input too thin for useful questions: ask for scope, timeline, and stakeholders in one message.
- A similar client name already exists: ask whether it's the same client.
- Two projects in one request: ask whether they're separate projects or one project with phases.
- A write fails partway: remove what this run created, log it, and say so. Don't leave a half-built folder.

## Closing check

Before you report done:

1. Run `validate_frontmatter` on every file you created.
2. Confirm the parent MOC lists the new project and the project `_MOC.md` lists the hub, each sub-note, and Changelog, with link text matching the filenames.
3. Show the result in one short table: file, frontmatter valid, MOC entry.

If a check fails, fix it and run the check again before the announcement.

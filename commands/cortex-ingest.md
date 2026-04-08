---
description: Scaffolds a new project in the vault from a brief, project name, or path to a brief file. Creates the full folder structure — _MOC, Project Context hub, sub-notes from personality.md, Changelog.md, and Notes/ — and updates the parent bucket MOC. Usage:/cortex-ingest <project name, brief, or path to brief file>. If no argument is given, asks what project to scaffold.
---

# /cortex-ingest

Invoke the `cortex-ingest-project` skill against the input in `$ARGUMENTS`.

**Arguments:** `$ARGUMENTS` — a project name, a pasted brief, or a filesystem path to a brief file (SOW, kickoff email, transcript, etc.). Optional. If empty, ask the user "What project should I scaffold? Paste a brief, a name, or a path to a brief file."

**Procedure:**
1. Load `cortex-ingest-project`.
2. If `$ARGUMENTS` is empty: ask the user what project to scaffold and wait for a response.
3. If `$ARGUMENTS` looks like a filesystem path and the file exists: read it and pass the contents as the brief.
4. Otherwise pass `$ARGUMENTS` directly as the brief/name and run the ingest workflow (`workflows/ingest-project.md`).
5. Return the scaffolded paths and any follow-up questions the skill surfaced.

**Failure modes:** delegate to `cortex-ingest-project`'s failure modes — no extra handling here.

**Related:** `skills/cortex-ingest-project/SKILL.md`

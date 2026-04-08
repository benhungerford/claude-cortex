---
name: cortex-ingest-project
description: Scaffolds a new project inside an existing vault. Takes raw project input (a brief, a transcript, an email, a brain dump, or just a project name) and creates the 6-element project folder (_MOC, Project Context hub, Tech Stack, Design System, Changelog, Notes/) under the correct client. Fires when the user starts a new project, shares a brief, or asks to start tracking something new.
---

# cortex-ingest-project

**STATUS: Stub.** Content being migrated from `skills/cortex/workflows/ingest-project.md`. Do not invoke yet.

## Purpose

Get a new project from zero to a fully scaffolded vault entry in one pass. Handles client creation if the client doesn't exist yet.

## Triggers

- "New project", "start tracking X", "I'm starting work on Y"
- User pastes a brief, contract, SOW, or kickoff email
- User shares a brain dump about something they want to work on

## Absorbs

- `skills/cortex/workflows/ingest-project.md`

## References

- `assets/blank-template.md`
- `references/vault-conventions.md`
- `references/section-guide.md`

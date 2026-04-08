---
name: cortex-knowledge
description: Extracts reusable patterns, vendor notes, debugging recipes, and how-to guides from conversation into the Knowledge Base/ folder. Fires when the conversation reveals a pattern that will apply beyond the current project, or when the user says "this is worth remembering", "file this as a reference", "add to knowledge base".
---

# cortex-knowledge

**STATUS: Stub.** Content being migrated from `skills/cortex/workflows/capture-knowledge.md`. Do not invoke yet.

## Purpose

Separate reusable knowledge from project-specific context. Reusable stuff goes to `Knowledge Base/` so it's findable from any future project.

## Triggers

- "This is reusable", "worth remembering", "add this to knowledge base"
- "File this as a reference", "save this pattern"
- Conversation reveals a vendor quirk, library gotcha, or recipe that will apply beyond this project

## Absorbs

- `skills/cortex/workflows/capture-knowledge.md`

## References

- `references/vault-conventions.md`

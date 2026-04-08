---
name: cortex-update-context
description: Writes decisions, scope changes, resolved blockers, new open questions, and client preferences to the correct project hub and Changelog.md. Appends to _changelog.txt. Never overwrites existing content silently — flags conflicts. Fires when the user says "log this", "we decided", "update the doc", "add this to the project", or when the conversation surfaces a Tier 1 capture opportunity.
---

# cortex-update-context

**STATUS: Stub.** Content being migrated from `skills/cortex/workflows/update-context.md`. Do not invoke yet.

## Purpose

The primary write path into the vault. Every decision, blocker, and scope change lands here. Enforces the "never silently overwrite" rule.

## Triggers

- "Log this", "log that", "add this to the project"
- "We decided", "decision:", "I'm going with"
- "New blocker", "this is blocking"
- "That blocker is resolved"
- Tier 1 capture detected by `cortex-boot` ambient watch

## Absorbs

- `skills/cortex/workflows/update-context.md`

## References

- `references/capture-rules.md`
- `references/vault-conventions.md`
- `references/section-guide.md`

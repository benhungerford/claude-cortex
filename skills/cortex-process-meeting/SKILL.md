---
name: cortex-process-meeting
description: Takes a meeting transcript (Granola, Fathom, pasted notes, email recap) and creates a properly-threaded meeting note in the correct project Notes/ folder or client Meetings/ folder. Handles series detection, previous/next threading, frontmatter, MOC updates, and cross-links decisions into the project Changelog and hub Open Questions.
---

# cortex-process-meeting

**STATUS: Stub.** Content being migrated from `skills/cortex/workflows/process-meeting.md`. Do not invoke yet.

## Purpose

Turn a raw transcript into a fully-filed, properly-threaded meeting note that extracts decisions and blockers into the right places.

## Triggers

- User pastes a transcript
- "Process this meeting", "here are the notes from X"
- Granola/Fathom MCP tool returns a transcript
- Email recap shared for a client call

## Absorbs

- `skills/cortex/workflows/process-meeting.md`

## References

- `references/vault-conventions.md` (meeting threading, routing)

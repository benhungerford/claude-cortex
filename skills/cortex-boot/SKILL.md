---
name: cortex-boot
description: Loads vault context at the start of any work-related conversation. Reads personality.md, memory.md, and the last 50 lines of _changelog.txt; resolves the current working directory against the repo registry; determines activation level (Passive / Vault-Aware / Full Project); surfaces active blockers in 1-3 sentences. Always-on pseudo-skill — will be replaced by a SessionStart hook in Stage 3.
---

# cortex-boot

**STATUS: Stub.** Content being migrated from `skills/cortex/SKILL.md` sections `<mode_detection>`, `<session_startup>`, `<essential_principles>`, `<activation_levels>`. Do not invoke yet — the monolith `cortex` skill is still authoritative.

## Purpose

Session startup. Make Claude vault-aware before the user finishes their first sentence. This is a temporary home for always-on behavior; in Stage 3 it becomes a `SessionStart` hook that caches the parsed files in the session env, and this skill shrinks to a tiny "read from cache" shim.

## Triggers

Broad — fires on any work-related conversation. Specific activators:
- Session start (any first message in a new session)
- User mentions a project, client, meeting, or vault concept
- cwd is inside the vault or a registered repo

## Absorbs

- `skills/cortex/SKILL.md` → `<mode_detection>`, `<session_startup>`, `<essential_principles>`, `<activation_levels>`
- `skills/cortex/workflows/resolve-cwd.md`

## References

- `references/capture-rules.md` (cross-cutting — loaded ambient)
- `references/activation-levels.md`
- `references/trigger-phrases.md`

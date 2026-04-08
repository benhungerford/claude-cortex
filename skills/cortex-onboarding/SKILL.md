---
name: cortex-onboarding
description: First-run setup for a new Cortex user. Walks the user through discovery (who they are, how they work, what tools they use), builds the Obsidian vault from scratch with the right folder structure and personality.md, connects external tools, and writes ~/.claude/cortex/config.json. Fires when no vault is detected or no personality file exists.
---

# cortex-onboarding

**STATUS: Stub.** Content being migrated from `skills/cortex/workflows/onboarding.md`. Do not invoke yet.

## Purpose

Turn a fresh install into a working vault in one session. This is the *only* skill that runs before a vault exists — every other skill assumes `personality.md` and `vault_path` are already in place.

## Triggers

- `~/.claude/cortex/config.json` missing or invalid
- `<vault_path>/personality.md` missing
- User says "first run", "I just installed Cortex", "set up my vault", "onboard me"

## Absorbs

- `skills/cortex/workflows/onboarding.md`

## References

- `assets/blank-template.md`
- `assets/personality-schema.md` (new, TBD in step 2)

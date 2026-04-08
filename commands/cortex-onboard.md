---
description: First-run setup for a new Cortex user. Walks through introductions, Obsidian install, vault creation, 5 discovery questions, MCP tool connections, and a generated personality.md. Usage:/cortex-onboard. Hard-routed — takes no arguments. Prints a warning if a vault already exists.
---

# /cortex-onboard

Invoke the `cortex-onboarding` skill as a hard route.

**Arguments:** none. `$ARGUMENTS` is ignored.

**Procedure:**
1. Load `cortex-onboarding`.
2. Check whether `~/.claude/cortex/config.json` exists and whether `<vault_path>/personality.md` exists.
3. If a vault already exists and is fully configured: print a warning — "A Cortex vault already exists at `<vault_path>`. Running onboarding will walk you through setup again but will not overwrite your existing `personality.md` or vault contents. Continue? (y/n)" — and wait for confirmation before proceeding.
4. Otherwise run the onboarding workflow (`workflows/onboarding.md`) directly.
5. On completion, surface the new vault path, the generated `personality.md` location, and any follow-up steps.

**Failure modes:** delegate to `cortex-onboarding`'s failure modes — including the partial-reset flow when the user wants to redo setup.

**Related:** `skills/cortex-onboarding/SKILL.md`

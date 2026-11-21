---
name: cortex-daily
description: Generates a tailored, copy-paste prompt for a Claude Routine that runs an unattended daily pipeline — pull from all live connectors, dedup, file content into the right vault folders, and assemble a daily briefing. Fires on "set up my daily routine", "build my daily briefing", "create a daily pipeline", or the daily_briefing progressive-feature handoff.
---

# cortex-daily

Build the prompt the user pastes into a Claude Routine (the scheduled, recurring run). The routine then runs on its own each day: pull from every live connector, dedup, file into the vault, write the briefing, log everything. This skill only generates the prompt; Claude Routines schedules and runs it.

Procedure: `workflows/generate-routine.md`.

## When it fires

- "set up my daily routine", "build my daily briefing", "create a daily pipeline", "generate my morning routine", `/cortex-daily`.
- A "yes" to the dormant `daily_briefing` feature offer (`references/progressive-features.md`).

## Tools

Cortex MCP tools are named `mcp__plugin_claude-cortex_cortex-vault__<tool>`: `find_project_by_cwd` (or `vault_path` in `~/.claude/cortex/config.json`), `list_projects`, `append_changelog`.

## Steps (detail in the workflow)

1. Resolve the vault path.
2. Detect inputs: projects, `personality.md`, live connectors by type, any saved routine.
3. Show the inferred profile; confirm connectors and run time.
4. Interview for sections, from the canonical menu filtered to live connectors.
5. Fill `assets/routine-skeleton.md` and insert section bodies from `assets/section-library.md` in the user's order.
6. Print the prompt in a fenced block and save `.claude/cortex/daily-routine.md`; log with `append_changelog`.
7. Tell the user to paste it into a new Claude Routine at the chosen time.

## Rules

- The skeleton's fixed rules stay as written in every generated prompt: the dedup guard, ambiguous items to `_Inbox/`, every write logged, no deletes or overwrites or duplicates, and no questions mid-run. Customization changes sections, not those rules.
- Sections key off connector type, and the body names the tool actually detected. Don't hardcode a vendor.
- Offer the YouTube section only when the user asks for it.
- Without `personality.md`, stop and send the user to `cortex-onboarding`.
- At L1, confirm before saving `.claude/cortex/daily-routine.md`; at L2 and up, save. Always print the prompt.
- Don't schedule the routine, run a briefing inline, or edit `personality.md` or `memory.md`.

Design spec: `docs/superpowers/specs/2026-06-25-cortex-daily-design.md`.

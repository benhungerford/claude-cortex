---
name: cortex-daily
description: Generates a tailored, copy-paste prompt for a Claude Routine that runs an unattended daily pipeline — pull from all live connectors, dedup, file content into the correct vault folders, and assemble a stepped daily briefing. Fires on "set up my daily routine", "build my daily briefing", "create a daily pipeline", or the daily_briefing progressive-feature activation handoff.
---

# cortex-daily

## Purpose

Generate a self-contained prompt the user pastes into a Claude **Routine** (the scheduled, recurring run feature). The generated routine runs unattended each day and executes the full pipeline: pull from every live connector → dedup → route/file into the correct vault folders → assemble a stepped daily briefing → write it and log everything.

This skill is a **generator**, not a runner. It inspects the vault and live connectors, runs a short interview for custom sections, then emits the prompt to chat and saves a copy. Claude Routines owns scheduling and execution.

Full playbook: `workflows/generate-routine.md`.

## When this skill fires

**Literal triggers:**
- "set up my daily routine", "build my daily briefing", "create a daily pipeline"
- "/cortex-daily"
- "generate my morning routine", "make a daily routine prompt"

**Handoff trigger:**
- The dormant `daily_briefing` progressive-feature activation prompt routes here on "yes" (see `references/progressive-features.md`).

## MCP Tool Preferences

When the `cortex-vault` MCP server is available, prefer these over manual file ops:

| Instead of... | Use MCP tool |
|---|---|
| Resolving the vault path | `find_project_by_cwd` (falls back to `~/.claude/cortex/config.json` → `vault_path`) |
| Enumerating projects + buckets | `list_projects` |
| Logging the generate/refresh op | `append_changelog` |

If MCP tools are unavailable (Desktop without the server), read `~/.claude/cortex/config.json` for `vault_path` and append to `_changelog.txt` manually.

## Procedure

Run `workflows/generate-routine.md`. It covers:

1. Resolve the vault path.
2. Auto-detect inputs (projects, `personality.md`, live connectors grouped by type, existing saved routine).
3. Present the inferred profile and confirm connectors + run-time.
4. Run the custom-section interview (canonical menu auto-filtered to live connectors; YouTube opt-in only).
5. Assemble the output prompt: fill `assets/routine-skeleton.md` rails, inject composed section bodies from `assets/section-library.md` in the user's order.
6. Emit to chat (fenced) and save `.claude/cortex/daily-routine.md`; log via `append_changelog`.
7. Instruct the user to paste it into a new Claude Routine at the chosen time.

## Critical rules

- The output prompt's locked rails are non-negotiable: dedup guard, ambiguous→`_Inbox/`, log every write, never delete/overwrite/duplicate, no mid-run questions. They come from `assets/routine-skeleton.md` and must never be edited away during customization.
- Sections key off connector **type**, never a hardcoded vendor. The composed body names the actual detected tool.
- Never propose the YouTube section; surface it only if the user explicitly asks.
- If `personality.md` is missing, stop and route to `cortex-onboarding`.

## What this skill does NOT do

- Does not schedule the routine (Claude Routines does).
- Does not run the briefing inline (generator only).
- Does not modify `personality.md` or `memory.md`.

## Related

- **Workflow:** `workflows/generate-routine.md`
- **Assets:** `assets/routine-skeleton.md`, `assets/canonical-sections.md`, `assets/section-library.md`
- **Spec:** `docs/superpowers/specs/2026-06-25-cortex-daily-design.md`
- **Wiring:** `references/trigger-phrases.md`, `references/progressive-features.md`

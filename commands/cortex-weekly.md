---
description: Generates a Weekly Review by reading project state across L1/L2/L3 (personality.md, bucket MOCs, project Context hubs and Changelogs) and writes a dated review note to Reflections/. Usage:/cortex-weekly. Takes no arguments — scans everything active.
---

# /cortex-weekly

Generate a Weekly Review from current vault state and file it to `Reflections/`. Inline composite — no single skill owns this workflow.

**Arguments:** none. `$ARGUMENTS` is ignored.

**Trigger:** user runs `/cortex-weekly`, or asks for a "weekly review", "week recap", "what happened this week", or "end of week summary".

**Procedure:**
1. Read `personality.md` to learn the vault's vocabulary (`bucket_term`, `sub_note_types`, `vault_path`) and the list of active buckets/projects.
2. Read the parent bucket MOC(s) to find every project with status `Active Build`, `Planning`, or `Ongoing Support`.
3. For each active project, read the Project Context hub and the last ~20 lines of the project's `Changelog.md`. Filter Changelog entries to the last 7 days.
4. Read the last 7 days of vault-root `_changelog.txt` to catch meetings filed, knowledge captured, and status changes across the whole vault.
5. Compose a Weekly Review note with these sections:
   - **Week at a glance** — 2-3 sentence narrative of the week
   - **Per-project updates** — one block per active project: stage, recent decisions, active blockers, next step (cite the hub file)
   - **Knowledge captured** — new Knowledge Base entries from the week
   - **Meetings filed** — list of new meeting notes with file citations
   - **Open questions for next week** — any unresolved blockers or decisions surfaced by the scan
6. Write the file to `<vault_path>/Reflections/YYYY-MM-DD Weekly Review.md` with frontmatter `type: weekly-review`, `created`, `updated`, and tag `"#type/weekly-review"`.
7. Append a `CREATED` entry to `_changelog.txt` and add the review to `Reflections/_MOC.md` if the folder has one.
8. Check: run `mcp__plugin_claude-cortex_cortex-vault__validate_frontmatter` on the review and confirm the MOC entry; fix anything that fails.
9. Return the file path and a one-paragraph summary, e.g. "Filed weekly review covering 5 active projects, 3 blockers, 2 decisions, 4 new meetings."

**Edge cases:**
- No active projects found: scan every project folder and ask the user to confirm the list.
- `personality.md` missing: stop and hand off to `cortex-onboarding`.
- A hub is missing or broken: skip that project, list it under "Open questions", and finish the rest.
- `Reflections/` doesn't exist: create it, log `CREATED`.
- A review for today already exists: write `-2` beside it and tell the user; overwrite nothing.

**Related:** `skills/cortex-check-status/SKILL.md` · the vault's `.claude/rules/changelog-format.md` and `frontmatter-and-tags.md`

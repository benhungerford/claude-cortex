---
description: Read-only status check for a project. Reads the Project Context hub and Changelog.md and surfaces current stage, active blockers, and recent decisions in 2-5 sentences with file citations. Usage:/cortex-status <project name or fuzzy match>. If no name is given, lists your top 3 most-recently-updated projects.
---

# /cortex-status

Invoke the `cortex-check-status` skill against the project named in `$ARGUMENTS`.

**Arguments:** `$ARGUMENTS` — a project name or fuzzy match. Optional. If empty, the skill lists the user's top 3 most-recently-updated projects and asks which to check.

**Procedure:**
1. Load `cortex-check-status`.
2. If `$ARGUMENTS` is empty: list the top 3 projects by `updated` date from personality.md and the vault's project folders, then wait for the user to pick.
3. If `$ARGUMENTS` is a non-empty string: pass it as the project identifier and run the check-status workflow (`workflows/check-status.md`).
4. Surface the focused summary with file citations.
5. Never write. This is read-only.

**Failure modes:** delegate to `cortex-check-status`'s failure modes table — no extra handling here.

**Related:** `skills/cortex-check-status/SKILL.md`

---
name: cortex-coach
description: Adaptive skill-development coaching. Reads work patterns, vault state, and learning history to give targeted guidance and spot growth areas. Fires on "teach me", "what should I be learning", "where can I improve", "coach me", "how could I do this better", "what am I missing", "review my approach", "skill check", or "growth check". Also runs on a schedule to write dated growth reports.
---

# cortex-coach

A coach, not a librarian: it tracks what the user doesn't know yet and helps close the gap, using their real projects as the material. `cortex-knowledge` files reusable knowledge; this skill teaches.

What coaching learns about the user (what they struggle with, what they've mastered, how they like to be taught) goes into `_profile.md`, so later sessions teach better. That loop is the point of the skill.

## Modes

| Mode | When | Workflow |
|---|---|---|
| First run | `Knowledge Base/Growth/_profile.md` doesn't exist | `workflows/coach-intake.md`, then on-demand |
| On demand | A trigger phrase | `workflows/coach.md` |
| Report | A scheduled task (weekly by default) or "growth report" | `workflows/coach-report.md` |

## Data

- `Knowledge Base/Growth/_profile.md`: preferences, strengths, growth edges, calibration notes.
- `Knowledge Base/Growth/_goals.md`: the user's stated goals.
- `Knowledge Base/Growth/_signals.log`: teaching moments. The UserPromptSubmit hook tags them, the Stop hook logs them, and this skill appends its own. Read the last 90 days at most.
- Vault activity: `_changelog.txt`, project hubs, and what's already in `Knowledge Base/`.

## Tools

Cortex MCP tools are named `mcp__plugin_claude-cortex_cortex-vault__<tool>`: `read_hub`, `list_projects`, `search_vault`, `append_changelog`, `update_moc`, `validate_frontmatter`.

## Rules

- Read `_profile.md` before teaching, and follow its learning preferences and calibration notes. If no preference is set, teach by walking through the user's own work, and offer to set one.
- Don't teach what the Knowledge Base shows they already know.
- Tie guidance to the current project. Unrelated topics are fine when the user asks for them.
- Log every coaching exchange to `_signals.log` without mentioning it.
- Send reusable insights to `cortex-knowledge`; don't file them here.
- Reports observe and recommend. They don't assign tasks or grade the user, and they don't invent patterns in a quiet week; say it was quiet.
- If coaching contradicts a Knowledge Base article, show both and let the user decide.
- Don't edit `personality.md`; the learner profile is `_profile.md`.

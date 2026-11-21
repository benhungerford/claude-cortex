# Capture rules: Tier 1 / 2 / 3

What Cortex captures from ordinary conversation, whichever skill is active. The session-start block points here; the write skills (`cortex-update-context`, `cortex-process-meeting`, `cortex-knowledge`, `cortex-ingest-project`) follow it. Capture is a background behavior, not a command the user runs.

## The two questions

1. Would the user want to find this in six months? If not, don't capture it.
2. Do I know exactly where it goes? If yes, Tier 1. If not, Tier 2.

## Tier 1: capture, then confirm in one line

| Signal | Destination | Confirmation |
|---|---|---|
| Scope, strategy, or direction decision | Hub + `Changelog.md` | `Logged to <Project> Changelog.` |
| New blocker | Hub Open Questions + `Changelog.md` | `Added blocker to <Project>.` |
| Blocker resolved | Remove the hub row; record it in `Changelog.md` | `Cleared blocker on <Project>.` |
| Meeting transcript or summary | `Notes/` via `cortex-process-meeting` | `Meeting note filed in <Project>.` |
| Client or collaborator preference | Hub Contacts | `Updated <Project> client preferences.` |
| Reusable pattern | `Knowledge Base/` via `cortex-knowledge` | `Extracted pattern to Knowledge Base.` |

Tier 1 doesn't ask first, with one exception: at L3, a signal Cortex inferred (the user didn't say "log that", "we decided", or similar) gets a one-line confirm before the write. Explicit phrases write at every level. See `activation-levels.md`.

## Tier 2: ask first

When the information could belong to more than one project, contradicts something documented, could be project-specific or reusable, or is the user thinking aloud rather than deciding. Ask one sentence at the next natural pause: "Want me to log the Shopify webhook decision to FKT, or is it still tentative?" A yes makes it Tier 1. A no drops it for the rest of the session.

## Tier 3: don't capture

How-to questions, debugging with nothing reusable (log a notable fix in the project Changelog, skip the rest), brainstorming without a decision, unrelated chat, rephrasings and acknowledgements, and anything the user says not to log.

## How to capture

- Wait for a natural break; don't interrupt a thought.
- Three or more captures close together share one confirmation: "Updated <Project>: logged the nav decision, cleared the Figma blocker, added a client preference." Order: decisions, blockers, preferences.
- Confirmations are one line: what and where.
- If a capture contradicts something documented, stop and show both before writing (the conflict rule in `cortex-update-context`).
- Otherwise capture should go unnoticed apart from the confirmation line.

## When it goes wrong

| Case | Do |
|---|---|
| The destination project doesn't exist | Hand off to `cortex-ingest-project`, then capture. Don't make ad-hoc files. |
| The write fails | Say so; keep the intent in the conversation; don't claim it was written. |
| "Don't capture that" after the fact | Revert the write, log the revert, confirm in one line. |
| "Capture that" about something from earlier | Find it, run the two questions, capture if it passes. |

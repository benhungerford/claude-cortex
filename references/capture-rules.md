# Capture Rules — Tier 1 / 2 / 3

Cross-cutting reference. This file defines the ambient behavior Cortex applies during **every** conversation in any runtime, regardless of which skill is active. It is loaded by `cortex-boot` and cited by every write-side skill (`cortex-update-context`, `cortex-process-meeting`, `cortex-knowledge`, `cortex-ingest-project`).

This file replaces the `cortex-capture` standalone skill originally proposed in the plugin migration plan. Capture is not a task the user triggers — it is a cross-cutting behavior.

---

## The two-question heuristic

Before capturing anything, ask yourself two questions in order:

1. **"Would the user want to find this in six months?"** If no → do not capture. Move on.
2. **"Do I know exactly where it goes?"** If yes → capture silently (Tier 1). If no → ask the user (Tier 2).

These two questions eliminate both over-capture (chat noise in the vault) and under-capture (decisions lost in conversation).

---

## Tier 1 — Always capture, silently, with a one-line confirmation

Fires automatically. No user confirmation required. A brief confirmation line goes in chat so the user knows the vault was updated.

| Signal in conversation | Destination | Confirmation line |
|---|---|---|
| User makes a scope, strategy, or direction decision | Project hub + `Changelog.md` | `Logged to <Project> Changelog.` |
| New blocker discovered | Project hub Open Questions + `Changelog.md` | `Added blocker to <Project>.` |
| Existing blocker resolved | Remove row from Open Questions + log resolution in `Changelog.md` | `Cleared blocker on <Project>.` |
| Meeting transcript or summary shared | Project `Notes/` folder (via `cortex-process-meeting`) | `Meeting note filed in <Project>.` |
| Client or collaborator preference stated | Project hub Contacts section | `Updated <Project> client preferences.` |
| Reusable pattern surfaces in conversation | `Knowledge Base/` (via `cortex-knowledge`) | `Extracted pattern to Knowledge Base.` |

**Tier 1 never asks permission.** If the conversation contains one of these signals and the destination is obvious, write it.

---

## Tier 2 — Ask before capturing

The destination is ambiguous, or the user may not want it captured yet.

Trigger this tier when:
- Information could apply to multiple projects (ask: "Is this for <A>, <B>, or both?")
- New info contradicts an existing documented decision (flag the conflict — see Conflict Rule below)
- Knowledge straddles project-specific vs. reusable (ask: "Should this live in <Project> or in Knowledge Base?")
- Exploratory information — user is thinking out loud, not deciding

**How to ask:** one sentence, at the next natural pause. Never interrupt mid-thought.

> "Want me to log the Shopify webhook decision to FKT, or is it still tentative?"

If the user says yes → promote to Tier 1. If no → drop it entirely (do not retain for later re-asking in the same session).

---

## Tier 3 — Never capture

Even if the user would find it interesting, these do not go in the vault. They create noise and make real captures harder to find.

- Casual how-to questions ("how do I reverse a list in Python?")
- Debugging sessions with no reusable pattern (bug specific to one line in one project — log in project changelog only if the fix is notable, otherwise skip)
- Brainstorming that hasn't led to a decision
- General conversation unrelated to work
- Rephrasings, clarifications, or acknowledgements
- Anything the user explicitly says "don't log this" about

---

## Capture behavior rules

**Never interrupt.** Capture at the next natural break in the conversation, not mid-sentence and not mid-thought.

**Batch consecutive captures.** If three or more captures happen in quick succession, collapse them into one confirmation:

> "Updated <Project>: logged the nav decision, cleared the Figma blocker, added a new client preference."

**One-line confirmations only.** Never write a paragraph explaining what you captured. The user sees the diff; tell them what and where, nothing more.

**The Conflict Rule.** If a new capture contradicts existing documented information, **stop and flag**. Never silently overwrite.

> `CONFLICT DETECTED: the new decision to use Stripe contradicts the existing Tech Stack note which lists Braintree. How would you like to resolve this?`

Wait for the user's decision before writing anything.

**The Invisible Rule.** The user should be able to have a normal conversation with Cortex active and never notice capture happening. The only time capture surfaces is the one-line confirmation after the fact or the Conflict flag.

---

## Failure modes

| Failure | What to do |
|---|---|
| Tier 1 destination doesn't exist yet (e.g. project not scaffolded) | Escalate to `cortex-ingest-project` to scaffold first, then capture into the new project. Do not silently create ad-hoc files. |
| Vault write fails (permissions, missing file) | Surface the error in chat, retain the capture intent in conversation context, do not pretend it was written. |
| Two Tier 1 signals in the same utterance (e.g. a decision AND a blocker) | Batch them into one confirmation line. Order: decisions → blockers → preferences. |
| User says "don't capture that" after Cortex has already captured | Remove the entry (revert the write), log the revert in `_changelog.txt`, confirm in one line. |
| User says "capture that" about something from five turns ago | Go back, find the reference, apply the two-question heuristic, capture if it passes. |

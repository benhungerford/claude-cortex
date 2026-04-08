---
description: Logs a decision, blocker, or note against the active project by routing it to the right vault file (Project Context hub, sub-note, or Changelog.md) and appending a Changelog entry. Usage:/cortex-capture <decision|blocker|note>: <content>. E.g. /cortex-capture decision: using Stripe for payments. If no argument is given, asks what to capture.
---

# /cortex-capture

Invoke the `cortex-update-context` skill against the input in `$ARGUMENTS`.

**Arguments:** `$ARGUMENTS` — a capture type (`decision`, `blocker`, or `note`) followed by `:` and the content. Examples:
- `decision: using Stripe for payments`
- `blocker: waiting on brand assets from client`
- `note: client prefers Thursday demos`

Optional. If empty, ask the user "What should I capture? Format: `decision|blocker|note: <content>`."

**Procedure:**
1. Load `cortex-update-context`.
2. If `$ARGUMENTS` is empty: ask the user what to capture and wait for a response.
3. Parse the leading type token (`decision`, `blocker`, `note`) and the content after the `:`. If no type is given, pass the whole string as a general capture and let the skill classify it.
4. Resolve the active project via the usual rules (most recent project, fuzzy match from conversation context, or ask).
5. Run the update-context workflow (`workflows/update-context.md`) to route to the correct file and append Changelog entries.

**Failure modes:** delegate to `cortex-update-context`'s failure modes — especially the conflict-detection rule (never silently overwrites).

**Related:** `skills/cortex-update-context/SKILL.md`

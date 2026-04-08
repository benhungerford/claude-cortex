---
name: cortex-update-context
description: The primary write path into a project's vault files. Routes decisions, scope changes, resolved blockers, new blockers, and client preferences to the correct file (Project Context hub, sub-note, or Changelog.md) and always appends a corresponding entry to the project Changelog and _changelog.txt. Enforces the conflict-detection rule — never silently overwrites. Fires on "log that", "we decided", "new blocker", "that's resolved", or any Tier 1 capture surfaced by cortex-boot's ambient watch.
---

# cortex-update-context

## Purpose

Take a decision, blocker, or scope change that appeared in conversation and write it to the right place in the vault. This is where the vault gets *kept current*. Every other write-side skill (`cortex-process-meeting`, `cortex-knowledge`) either calls into this skill or applies the same routing rules.

The full playbook lives in `workflows/update-context.md`.

## When this skill fires

**Literal triggers:**
- "log that", "log this", "log it"
- "add this to the project", "add that to <Project>"
- "we decided", "decision:", "I'm going with <X>", "going to go with <X>"
- "final answer is <X>", "we're using <X>"
- "new blocker", "blocker:", "this is blocking", "blocked by"
- "that's resolved", "blocker resolved", "unblocked"

**Ambient triggers** (via `cortex-boot`'s capture watch):
- Tier 1 capture fired during normal conversation. See `references/capture-rules.md`.

See rows 6–9 in `references/trigger-phrases.md`.

## Procedure

Run `workflows/update-context.md`. The workflow covers:

1. **Identify the change type** — decision, new blocker, resolved blocker, scope change, status change, or new resource
2. **Route to the correct file(s)** — use the routing table below
3. **Read current context** — only the files you intend to modify
4. **Check for conflicts** — apply the Conflict Rule (see below) before any write
5. **Apply changes** — update the section(s), bump `updated` in YAML frontmatter
6. **Log to `Changelog.md`** — every significant decision gets an entry
7. **Clean up resolved blockers** — remove the row from Open Questions entirely (no strikethrough)
8. **Append to `_changelog.txt`** — every file operation gets one line
9. **Announce the update** — one line, tight, listing files modified

## Routing table

| Change type | Primary file | Also update |
|---|---|---|
| Scope, strategy, or direction decision | Hub (`— Project Context.md`) | `Changelog.md`, `_changelog.txt` |
| New blocker or open question | Hub → Open Questions table | `Changelog.md`, `_changelog.txt` |
| Blocker resolved | Hub → **remove** row from Open Questions | `Changelog.md` (log resolution), `_changelog.txt` |
| Technical decision (stack, architecture, library) | Relevant sub-note (per `personality.md` sub_note_types, typically Tech Stack & Architecture) | Hub (if material), `Changelog.md`, `_changelog.txt` |
| Design decision (tokens, typography, layout direction) | Design System sub-note | Hub (if material), `Changelog.md`, `_changelog.txt` |
| Scope change (added or removed work) | Hub | `Changelog.md`, `_changelog.txt` |
| Status / stage change | Hub → Stage Tracker | `Changelog.md`, `_changelog.txt` |
| Client preference | Hub → Contacts or Overview | `Changelog.md`, `_changelog.txt` |
| New resource or link | Relevant sub-note | `_changelog.txt` (no Changelog entry for pure link additions) |
| New sub-note created | The new file | `_MOC.md`, Hub Quick Links, `_changelog.txt` |

**Every significant decision gets logged to `Changelog.md`, regardless of primary file.** The only exceptions are pure link additions and pure frontmatter bumps.

## Critical rules

### The Conflict Rule

Before writing anything, compare the new information against the current state of the target file. If the new information **contradicts** existing content, stop and flag:

> `CONFLICT DETECTED: the new decision to use Stripe contradicts the existing Tech Stack note which lists Braintree. How would you like to resolve this?`

Wait for the user's decision. Never silently overwrite. The conflict must list:
- What the new information says
- What the existing content says
- The file path where the contradiction lives

If the user resolves ("use the new Stripe decision"), apply the write and add a Changelog entry that notes the supersession: `2026-04-08 · Switched from Braintree to Stripe · <User> · Previous Braintree decision from 2026-03-15 superseded.`

### The Blocker-Resolved Rule

When a blocker is resolved:

1. **Remove** the row from the Hub's Open Questions table entirely. Do not use strikethrough. Do not mark it "resolved" in-place.
2. **Renumber** remaining rows if they were numbered.
3. **Add** a Changelog entry with the resolution date, what was resolved, and any relevant context from the conversation.
4. **Log** the removal to `_changelog.txt`.

Rationale: leaving strikethrough blockers accumulates noise in the hub and makes the Open Questions table harder to scan at a glance. The Changelog is the permanent record.

### The YAML Bump Rule

Every file that is modified gets its `updated:` frontmatter field bumped to today's date. No exceptions. This is how `cortex-boot` and `cortex-check-status` know what's fresh.

### The Single-File-Read Rule

Only read the files you intend to modify. If you're logging a decision to the hub and changelog, you read the hub and changelog. You do NOT pre-emptively read the Tech Stack sub-note "just in case". Scope is important here — the skill should be fast.

## Worked examples

### Example 1 — Simple decision

```
User: "log that we're going with Rebuy for the cart instead of ReCharge"

Change type: technical decision (cart platform).
Route to: Tech Stack & Architecture sub-note + Changelog.md.

Step 3: Read
  Work/TBL/Frankl & Thomas/Shopify Website Build/Tech Stack & Architecture.md
  Work/TBL/Frankl & Thomas/Shopify Website Build/Changelog.md

Step 4: Check for conflicts. Tech Stack currently says "ReCharge (subscription
  + cart)". This IS a conflict.

Surface:
  "CONFLICT DETECTED: Tech Stack & Architecture currently lists ReCharge for
  subscriptions + cart, decided on 2026-03-12. The new decision switches cart
  to Rebuy. Does ReCharge still handle subscriptions, or are we dropping it
  entirely?"

User: "keep ReCharge for subs, Rebuy just for cart."

Step 5: Apply changes.
  Tech Stack: update the Cart line to "Rebuy", leave Subscriptions as ReCharge.
  Add a note: "Split off cart from subscription handler on 2026-04-08."
  Bump `updated:` in frontmatter.

Step 6: Changelog entry:
  "2026-04-08 · Switched cart from ReCharge to Rebuy · Ben · ReCharge still
   handles subscriptions. Split decided to reduce subscription flow coupling."

Step 7: n/a (no blocker cleanup).

Step 8: _changelog.txt:
  [2026-04-08 HH:MM] UPDATED | FILE: Tech Stack & Architecture.md | DEST: Work/TBL/Frankl & Thomas/Shopify Website Build/ | NOTE: Cart switched ReCharge → Rebuy
  [2026-04-08 HH:MM] UPDATED | FILE: Changelog.md | DEST: Work/TBL/Frankl & Thomas/Shopify Website Build/ | NOTE: Cart decision logged

Step 9: Announce:
  "Updated FKT: cart switched from ReCharge to Rebuy in Tech Stack.
   Logged to Changelog. ReCharge retained for subscriptions."
```

### Example 2 — Blocker resolved

```
User: "we got the Stripe sandbox creds — clearing that blocker"

Change type: blocker resolved.
Route to: Hub Open Questions (remove row) + Changelog.md.

Step 3: Read FKT hub. Open Questions table row:
  | 1 | Waiting on Stripe sandbox credentials | Dependency | Client | Open |

Step 4: No conflict.

Step 5: Remove the row entirely (not strikethrough). Renumber if there
  are other numbered rows.

Step 6: Changelog entry:
  "2026-04-08 · Stripe sandbox credentials received · Client · Blocker
   open since 2026-03-22 resolved. Sandbox access confirmed."

Step 7: Blocker cleanup: done in Step 5.

Step 8: _changelog.txt:
  [2026-04-08 HH:MM] UPDATED | FILE: Shopify Website Build — Project Context.md | DEST: Work/TBL/Frankl & Thomas/Shopify Website Build/ | NOTE: Blocker resolved (Stripe sandbox creds)
  [2026-04-08 HH:MM] UPDATED | FILE: Changelog.md | DEST: Work/TBL/Frankl & Thomas/Shopify Website Build/ | NOTE: Stripe sandbox resolution logged

Step 9: Announce:
  "Cleared Stripe sandbox blocker on FKT. Logged resolution to Changelog."
```

### Example 3 — Ambient Tier 1 capture (no explicit trigger phrase)

```
Conversation context: User is at L3 in the FKT project. Mid-conversation:

User: "yeah Ashley confirmed they're fine with delaying the wholesale portal
       until phase 2, so we can pull that out of scope for now"

cortex-boot's capture watch detects a Tier 1 signal: scope change.
→ invokes cortex-update-context with the extracted intent.

Change type: scope change (removal).
Route to: Hub + Changelog.md.

Step 3-6 proceed normally. Hub's Scope section updated to note "wholesale
  portal moved to phase 2, confirmed by Ashley 2026-04-08". Changelog logged.

Step 9: Announce tight:
  "Updated FKT: wholesale portal moved out of scope (phase 2). Logged."
```

## Failure modes

| Failure | What to do |
|---|---|
| Project unclear from context | Ask once: "Is this for <closest-match> or another project?" Do not write until confirmed. |
| Target file missing | Surface: "<file> is missing from <Project>. Want me to scaffold it from the template?" Do not auto-create. |
| Conflict rule triggers | Stop immediately. Surface both versions. Wait for the user's resolution. |
| User says "log that" but the preceding turn is ambiguous about what "that" is | Ask: "Log which part — the decision to use X, or the note about Y?" Do not guess. |
| Resolved blocker doesn't actually exist in the Open Questions table | Surface: "I don't see that blocker in <Project>'s Open Questions. Should I add the resolution to the Changelog only, or is this a blocker from a different project?" |
| User logs a decision but the contradicting content isn't in the target file — it's in a different file the skill wasn't planning to read | Catch this by scanning the hub's Quick Links table for any sub-note titles that contain keywords from the new decision. If a match, read that sub-note before writing. |
| Write fails mid-operation (disk, permission) | Roll back any writes that already completed in this invocation. Log the rollback. Announce the failure. Do not leave the vault in a partially-updated state. |
| Frontmatter is malformed and cannot be parsed for the `updated:` bump | Write the content change anyway, but surface: "Warning: <file>'s YAML is malformed — could not bump `updated:`. Please fix the YAML." |
| User says "log this to <wrong-project>" where wrong-project doesn't exist | Ask: "I don't see a project called <wrong>. Did you mean <closest>, or is this a new project?" Do not create a new project from an update call — hand off to `cortex-ingest-project` if they confirm it's new. |

## What this skill does NOT do

- Does not read entire project trees. Only the specific files it will modify.
- Does not reorganize or clean up files. Only applies the requested change.
- Does not extract knowledge to the Knowledge Base — that's `cortex-knowledge`. But it can hand off if the user's decision is clearly a reusable pattern.
- Does not process meeting transcripts — that's `cortex-process-meeting`, which itself calls into this skill for the per-decision writes.
- Does not create new projects or clients. Hands off to `cortex-ingest-project`.

## Related

- **Workflow:** `workflows/update-context.md`
- **References:** `references/capture-rules.md`, `references/vault-conventions.md`, `references/section-guide.md`
- **Handoff targets:** `cortex-ingest-project` (new project), `cortex-knowledge` (reusable pattern), `cortex-process-meeting` (if multiple decisions came from a meeting)
- **Callers (ambient):** `cortex-boot` (via capture rules), `cortex-process-meeting`, `cortex-knowledge`
- **Triggers:** rows 6–9 in `references/trigger-phrases.md`

---
name: cortex-boot
description: Always-on session bootstrap. Interprets the <cortex-session> block injected by the session-start hook to determine activation level and guide session behavior. Makes zero file reads — all vault context is pre-loaded by the hook.
---

# cortex-boot

## Purpose

Interpret the vault context already loaded by the session-start hook and apply the appropriate activation level behavior. Every other Cortex skill assumes this interpretation has happened.

The session-start hook (`hooks/session-start`) calls `hooks/lib/boot-context.py` to read all vault files, resolve the working directory to a project, and compute the activation level. The result arrives as a `<cortex-session>` block in the conversation context before the model sees the first message. This skill reads that block — it never reads files directly.

## When this skill fires

- **Every session, first message.** Always. No exceptions.

## Inputs

All inputs come from the `<cortex-session>` block already in the conversation context:

| Field | Location in block |
|---|---|
| Activation level | `Level:` line (L1/L2/L3) |
| Vault path | `Vault:` line |
| Personality | `<cortex-personality>` sub-block |
| Memory | `<cortex-memory>` sub-block |
| Project context (L3) | `Project:`, `Stage:`, `Blockers:`, `Open questions:`, `Recent decisions:` lines |
| Active projects (L1/L2) | `Active projects:` line |
| Recent changelog | `Recent activity:` section |
| Inbox count | `Inbox:` line |
| Dormant feature suggestion | `Feature suggestion:` line (if present) |

## Procedure

**Step 1 — Check for session context.**

Look for a `<cortex-session>` block in the conversation context.

- If absent → **hand off to `cortex-onboarding`**. The hook found no config or no vault.
- If present but `<cortex-personality>` is empty → proceed with reduced context. Note once: `Cortex loaded without personality data.`

**Step 2 — Read the activation level.**

Extract the `Level:` line. It will be one of:

- `L1 — Passive`
- `L2 — Vault-Aware`
- `L3 — Full Project`

If the line is missing or unrecognized, default to L1.

**Step 3 — Apply the activation level contract.**

See `references/activation-levels.md` for the full specification. Summary:

| Level | Visible behavior on first message |
|---|---|
| **L1** | Say nothing. Answer the user's question directly. Watch for capture signals silently. |
| **L2** | Say nothing, unless a stale blocker or urgent inbox item is worth surfacing — one line max. |
| **L3** | One opening line: project name, stage, blocker count. Example: `FKT Shopify Website Build — Integrations stage. 2 open blockers. Ready.` |

**Step 4 — Queue dormant-feature suggestion.**

If the session block contains a `Feature suggestion:` line, queue it for the next natural conversational pause. **Do not surface it during boot.** Maximum one suggestion per session.

**Step 5 — Be ready.**

Do not present a menu. Do not list everything loaded. Do not summarize what you know. Let the user drive the conversation. The personality, memory, and project context are background — use them to inform responses, not to announce them.

## What cortex-boot does NOT do

- **Does not read files.** All context is in `<cortex-session>`.
- **Does not create files.** Boot is read-only.
- **Does not present a menu** or "here's what I know" dump.
- **Does not escalate activation levels past user intent.** A project-name match in an incidental reference does not escalate from L1 to L2.
- **Does not run other skills.** Each task skill is triggered by the user, not by boot.
- **Does not offer dormant-feature suggestions during boot** — only queues them.

## Worked examples

### Example 1 — No session block (first install)

```
User opens Claude Code. No <cortex-session> block in context.

Step 1: No session block → hand off to cortex-onboarding.
cortex-boot does nothing visible. cortex-onboarding takes over.
```

### Example 2 — L1 passive session

```
<cortex-session> block present with Level: L1 — Passive.
User's first message: "how do I reverse a list in Python?"

Step 1: Block present.
Step 2: Level = L1.
Step 3: Say nothing. Answer the Python question directly.
Step 4: Feature suggestion line present → queued for later.
Step 5: Done.
```

### Example 3 — L3 full project session

```
<cortex-session> block present with:
  Level: L3 — Full Project
  Project: FKT Shopify Website Build
  Stage: Integrations
  Blockers: Stripe sandbox credentials; sandbox access expiring Friday

User's first message: "morning, let's pick up where we left off"

Step 1: Block present.
Step 2: Level = L3.
Step 3: Opening line:
  "FKT Shopify Website Build — Integrations stage. 2 open blockers:
  Stripe sandbox credentials and sandbox access (expiring Fri). What
  are we tackling?"
Step 4: No feature suggestion.
Step 5: Done. User drives from here.
```

## Failure modes

| Failure | What cortex-boot does |
|---|---|
| No `<cortex-session>` block in context | Hand off to `cortex-onboarding` with reason "no session context". |
| `<cortex-personality>` sub-block is empty | Proceed with reduced context. One-line note: `Cortex loaded without personality data.` |
| `Level:` line missing or unrecognized | Default to L1. |
| `<cortex-memory>` sub-block is empty | Proceed normally. Memory is optional. |
| Multiple `Feature suggestion:` lines | Pick the first one. Queue it. Ignore the rest. |

## Related

- **Hook:** `hooks/session-start` — produces the `<cortex-session>` block
- **Python module:** `hooks/lib/boot-context.py` — reads vault files and computes activation level
- **References:** `references/activation-levels.md`, `references/capture-rules.md`
- **Handoff target:** `cortex-onboarding` (when no session block is present)

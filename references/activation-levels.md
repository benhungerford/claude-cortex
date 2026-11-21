# Activation levels: L1 / L2 / L3

How much Cortex reads, writes, and volunteers depends on where the session is. The session-start hook works out the level (`hooks/lib/boot-context.py` walks up from the cwd and matches the registry) and states it in the session context block as `Level: L1 — Passive`, `L2 — Vault-Aware`, or `L3 — Full Project`. On a surface without hooks, `get_boot_context` returns the same block. Skills read the level from there; they don't compute it. This file is the detail behind that line.

## L1 — Passive

**When:** the cwd is outside the vault and every registered repo, and no project has come up.

- `personality.md` and `memory.md` context is loaded; nothing else is read.
- Watch for capture signals (`capture-rules.md`) and handle them by its two-question test, but don't write to the vault without clear intent from the user.
- No status updates or "here's what's in your vault" messages.

Example: in `~/Documents/scratch/` the user asks about a regex. Answer it. If they then mention the FKT checkout, move to L2.

## L2 — Vault-Aware

**When:** the cwd is inside the vault, the user names a project from `personality.md`, or they mention a vault concept ("what's in my inbox", "the Jumpstart changelog").

- Read a project's hub the first time it comes up; read the tail of `_changelog.txt` when asked what happened recently.
- Apply Tier 1 and Tier 2 capture rules as things happen. Tier 1 captures write without asking.
- Offer one-line status facts when they're relevant: "That project has an open blocker on the API credentials. Want the details?"

## L3 — Full Project

**When:** the cwd resolves to a registered repo, or the user focuses the session on a project ("let's work on FKT for the next hour").

- Read the hub on each turn that depends on it, because decisions change during the session.
- Raise blockers at the start and whenever the work touches them.
- Ask whether new work belongs to the project when it looks like scope creep: "Is this part of <Project> or a new scope item?"
- Keep clarifying questions to 2-3, about scope and dependencies.
- Writes from a repo session need the user's intent. Explicit phrases ("log that", "we decided", "new blocker") write as Tier 1. An inferred capture gets a one-line confirm first, such as `Log that the wholesale portal moved out of scope for FKT? (y)`, because someone heads-down in a repo is more likely producing debugging chatter than decisions. At L1 and L2, inferred Tier 1 captures still write without the confirm.
- In the first L3 reply of a session, add once: `(say 'log that' to capture decisions)`.

Example opener in `~/Documents/Freelance Projects/fkt-checkout/`: "FKT — Shopify Website Build. Stage: Integrations. 2 open blockers: Stripe credentials, sandbox access."

## Moving between levels

| Event | Change |
|---|---|
| User names a known project | L1 → L2 |
| cwd is inside the vault | → L2 |
| cwd matches a registered repo, or "let's work on <Project>" | → L3 |
| 3+ turns on something unrelated, or "step back" / "let's park this" | L3 → L2 |
| 5+ turns away from the vault | L2 → L1 |

Say so when stepping down from L3: `(stepping out of <Project> focus)`. Don't step up just because a project name appears in your own answer to an unrelated question.

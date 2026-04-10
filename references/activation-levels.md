# Activation Levels — L1 / L2 / L3

Cortex modulates behavior based on session context. There are three levels. Each level defines how aggressively Cortex reads from, writes to, and surfaces information from the vault.

Loaded by `cortex-boot` at session start and referenced by every skill that needs to know how proactive to be.

---

## Level 1 — Passive

**When:** Default. Active when cwd is outside the vault AND outside any registered repo, AND the user has not mentioned a project by name.

**Behavior:**
- Memory (`personality.md`, `memory.md`) is loaded silently at session start
- Cortex watches the conversation for Tier 1 and Tier 2 capture signals (see `capture-rules.md`)
- No proactive status surfaces, no "here's what's happening in your vault" messages
- If a capture opportunity appears, Cortex handles it according to the two-question heuristic
- Cortex never writes to the vault without clear user intent at this level

**Example:** User opens a Claude Code session in `~/Documents/random-scratch/` and asks Cortex to explain a Python regex. Cortex answers the question. No vault activity. If mid-conversation the user says "I'm trying to debug the FKT checkout flow", Cortex escalates to Level 2.

---

## Level 2 — Vault-Aware

**When:** cwd is inside the vault directory, OR the user mentions a project name that matches a bucket in `personality.md`, OR the user explicitly references a vault concept ("what's in my inbox", "the Jumpstart changelog", etc.).

**Behavior:**
- Everything from Level 1, plus:
- Reads the relevant project's context hub on the first turn that references it
- Checks the tail of `_changelog.txt` for recent activity if the user asks "what happened recently" or similar
- Actively applies Tier 1 / Tier 2 capture rules — any decision, blocker, or meeting outcome captured without waiting
- Surfaces one-line status facts when relevant ("That project has an open blocker on the API credentials — want me to pull the details?")
- Vault writes are allowed freely for Tier 1 captures

**Example:** User says "quick question about FKT — is the Stripe integration in scope for launch?" Cortex reads the FKT hub, answers from the stage tracker + open questions table, cites the file it pulled from.

---

## Level 3 — Full Project

**When:** cwd resolves to a registered repo via `workflows/resolve-cwd.md`, OR the user explicitly focuses on a specific project for the session ("let's work on FKT for the next hour").

**Behavior:**
- Everything from Level 2, plus:
- Reads the project hub on every turn (not cached — the user is actively making decisions and we don't want stale state)
- Surfaces blockers proactively at the start of the session and whenever the conversation drifts into affected areas
- Flags scope creep automatically — if the user starts discussing work that isn't in the current project scope, Cortex asks "is this part of <Project> or is it a new scope item?"
- Limits clarifying questions to 2-3 at a time, focused on scope and dependency readiness
- **Default: read-only against the vault.** Explicit user confirmation is required before writing from a repo-context session. Rationale: inside a repo, the user is writing code and we don't want Cortex accidentally filing debugging chatter into the vault.
- Exception to read-only: when the user uses an explicit trigger phrase ("log this", "we decided", etc.) — those override the read-only default.

**Example:** User opens a Claude Code session in `~/Documents/Freelance Projects/fkt-checkout/`. `cortex-boot` walks cwd up, matches the repo to the FKT project in the registry, reads the hub, and opens the session with: "FKT — Shopify Website Build. Current stage: Integrations. 2 open blockers: Stripe credentials, sandbox access. Anything I can help with?"

---

## Escalation rules

Levels escalate automatically. A session can start at L1 and end at L3. They also de-escalate if context drifts.

| Trigger | Transition |
|---|---|
| Session start, cwd outside vault, no project name yet | L1 |
| User mentions a known project name | L1 → L2 |
| cwd is inside vault | L1/L2 → L2 |
| cwd matches a registered repo | any → L3 |
| User says "let's work on <Project>" | any → L3 |
| User changes subject to unrelated chat for 3+ turns | L3 → L2 |
| User explicitly says "step back" or "let's park this" | L3 → L2 |
| User leaves vault context for 5+ turns of unrelated chat | L2 → L1 |

**Never silently demote.** If Cortex is at L3 and drops to L2, note it briefly: `(stepping out of <Project> focus)`. The user should know when Cortex stops watching a specific project.

**Never escalate past user intent.** If the user is clearly at L1 — asking how-to questions that have nothing to do with their vault — do not escalate to L2 just because a project name happens to appear in the answer.

---

## Runtime detection

The `session-start` hook computes the activation level at boot and includes it in the `<cortex-session>` block as the `Level:` line:

- `Level: L1 — Passive`
- `Level: L2 — Vault-Aware`
- `Level: L3 — Full Project`

For L3 sessions, the hook also includes the matched project name, current stage, open blockers, open questions, and recent decisions.

The Python module `hooks/lib/boot-context.py` performs the actual resolution: reading `registry.json`, walking up from cwd, and matching against registered `repo_paths`. `cortex-boot` reads the pre-computed level from the session block — it never computes the level itself.

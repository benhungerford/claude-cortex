---
name: cortex-boot
description: Always-on session bootstrap. Runs on the first message of every Claude session to load the user's Obsidian vault context, resolve the current working directory to a project if possible, detect the activation level (L1 Passive / L2 Vault-Aware / L3 Full Project), and surface any critical blockers in one or two sentences. Loads capture-rules.md so the model is watching for decisions, blockers, and meeting outcomes throughout the conversation. This is a temporary home for always-on behavior — in Stage 3 it will be replaced by a SessionStart hook.
---

# cortex-boot

## Purpose

Make Claude vault-aware before the user finishes their first sentence. Every other Cortex skill assumes that `personality.md` has been read, `memory.md` is loaded, and the activation level is known. This skill establishes that state.

## When this skill fires

- **Every session, first message.** Always. No exceptions.
- Re-runs whenever the user changes the working directory mid-session (if cwd detection is available).
- Re-runs whenever the user says "switch to <Project>" or similar, so the activation level can escalate.

## Inputs

| Input | Source |
|---|---|
| `vault_path` | `~/.claude/cortex/config.json` → `vault_path` |
| Personality | `<vault_path>/personality.md` |
| Recent activity | Last 50 lines of `<vault_path>/_changelog.txt` |
| Accumulated context | `<vault_path>/memory.md` |
| cwd | Process working directory |
| Repo registry | `<vault_path>/.claude/cortex/registry.json` (via `workflows/resolve-cwd.md`) |

## Procedure

**Step 1 — Locate the vault.**

Read `~/.claude/cortex/config.json`. Extract `vault_path`.

- If the file does not exist, `vault_path` is missing, or the directory does not exist → **hand off to `cortex-onboarding`** and stop. Do not attempt any further boot steps. The user has no vault yet.

**Step 2 — Check for personality.**

Read `<vault_path>/personality.md`.

- If missing → **hand off to `cortex-onboarding`** with a note that onboarding is partial (vault exists but was not configured).

**Step 3 — Load ambient context.**

In parallel, read:
1. `<vault_path>/personality.md` — full file
2. `<vault_path>/memory.md` — full file
3. `<vault_path>/_changelog.txt` — last 50 lines only

Hold this content in the session. Do not summarize it to the user. It is background context, not an opening statement.

**Step 4 — Resolve cwd.**

Run `workflows/resolve-cwd.md`. It returns one of four outcomes:

| Outcome | Set activation level | Action |
|---|---|---|
| cwd is inside `vault_path` | L2 — Vault-Aware | Check tail of `_changelog.txt` and `_Inbox/` for anything actionable |
| cwd matches a registered repo | L3 — Full Project | Read that project's hub file. Load blockers and recent decisions into memory. |
| cwd contains an orphaned Cortex stub (`CLAUDE.md` with the stub phrases) | — | Hand off to `cortex-register-repo` (orphan branch) |
| cwd is unregistered and has no stub | L1 — Passive | Hold vault context silently. Do nothing visible. |

See `references/activation-levels.md` for the full L1/L2/L3 contract.

**Step 5 — Scan for dormant-feature suggestions.**

Read `personality.md` → `progressive_features.dormant`. For each dormant feature, evaluate its `activation_signal` against recent `_changelog.txt` activity and the current vault state. If any signal has fired and the cooldown has expired, queue a suggestion to offer at the next natural pause. **Maximum one queued suggestion per session.**

See `references/progressive-features.md` for the signal evaluation rules.

**Step 6 — Apply capture rules for the rest of the session.**

Load `references/capture-rules.md` into working memory. For the remainder of the session, every user utterance is evaluated against the Tier 1 / Tier 2 / Tier 3 heuristics. Tier 1 captures fire silently with a one-line confirmation. Tier 2 captures ask the user. Tier 3 is ignored.

**Step 7 — Be ready.**

Do not present a menu. Do not list everything you just loaded. Let the user drive the conversation. The only thing visible from boot is:

- **L1 sessions:** nothing. Stay silent.
- **L2 sessions:** nothing, unless there is an urgent item in `_Inbox/` or a stale blocker in the changelog worth surfacing — in that case, one line: `Heads up: <Project> has an unresolved blocker on the Figma review from 9 days ago.`
- **L3 sessions:** one opening line stating which project was detected, current stage, and open blocker count. Example: `FKT Shopify Website Build — Integrations stage, 2 open blockers. Ready.`

## Worked examples

### Example 1 — Cold start, no vault yet

```
User opens Claude Code in ~/Downloads. First message: "hey"

Step 1: ~/.claude/cortex/config.json is missing.
Step 2-7: skipped.
Action: hand off to cortex-onboarding with reason="no config".
cortex-boot silent. cortex-onboarding takes over with the first-run introduction.
```

### Example 2 — Level 1 passive session

```
cwd: ~/scratch/python-experiments
First message: "how do I reverse a list in Python?"

Step 1: config.json exists, vault_path valid.
Step 2: personality.md loaded.
Step 3: memory.md, last 50 changelog lines loaded silently.
Step 4: resolve-cwd returns unregistered, no orphaned stub.
Activation level: L1.
Step 5: one dormant-feature signal ready (weekly_review). Queued for next natural pause.
Step 6: capture rules loaded.
Step 7: say nothing. Answer the Python question directly.
```

### Example 3 — Level 3 full-project session

```
cwd: ~/Documents/Freelance Projects/fkt-checkout
First message: "morning, let's pick up where we left off"

Step 1-3: vault loaded.
Step 4: resolve-cwd walks up from cwd, finds ~/Documents/Freelance Projects/fkt-checkout in the registry under project FKT Shopify Website Build.
Hub read. Two open blockers: "Stripe sandbox credentials", "sandbox access expiring Friday".
Activation level: L3.
Step 5: no dormant-feature signals.
Step 7: opening line:
  "FKT Shopify Website Build — Integrations stage. 2 open blockers: Stripe
  sandbox credentials and sandbox access (expiring Fri). What are we tackling?"
```

## Failure modes

| Failure | What cortex-boot does |
|---|---|
| `~/.claude/cortex/config.json` exists but is malformed JSON | Surface the parse error in one line: `Cortex config at ~/.claude/cortex/config.json is malformed — <error>. Please fix or re-run onboarding.` Do not pretend boot succeeded. |
| `vault_path` points at a directory that doesn't exist | One line: `Cortex config points at a vault that doesn't exist: <path>. Update ~/.claude/cortex/config.json or re-run onboarding.` Do not proceed. |
| `personality.md` is missing but vault directory exists | Hand off to `cortex-onboarding` with `reason="personality missing"`. Onboarding detects the partial state and offers to resume. |
| `personality.md` exists but has invalid YAML | One line: `personality.md YAML is invalid — <error>. Continuing with reduced context.` Proceed with empty defaults. Do not crash. |
| `_changelog.txt` is missing | Create it with a single initialization entry, log to itself, continue. |
| `_changelog.txt` is very large (>10 MB) | Read only the last 50 lines via tail semantics. Do not read the whole file. |
| `memory.md` is missing | Proceed without it. Do not create it on boot — only `cortex-onboarding` creates initial `memory.md`. |
| resolve-cwd errors (e.g. registry corrupted) | Treat as L1. Surface a one-line warning: `Project registry unreadable — running in Passive mode.` Do not crash. |
| Multiple dormant-feature signals fire simultaneously | Pick one per the priority rules in `references/progressive-features.md`. Queue only one. |

## What cortex-boot does NOT do

- Does not create files. Only reads.
- Does not present a menu, list, or "here's what I know" dump.
- Does not offer dormant-feature suggestions during boot — only queues them for the next natural pause.
- Does not escalate activation levels past user intent. A project-name match in an incidental reference does not escalate from L1 to L2.
- Does not run `cortex-check-status` or any other task skill. Each task skill is triggered by the user, not by boot.

## Related

- **Workflow:** `workflows/resolve-cwd.md` — cwd → project lookup
- **References:** `references/activation-levels.md`, `references/capture-rules.md`, `references/progressive-features.md`, `references/vault-conventions.md`
- **Triggers:** see rows 1–4 in `references/trigger-phrases.md`
- **Stage 3 successor:** a `SessionStart` hook will eventually replace steps 1–4. When it exists, this skill shrinks to a "read-from-session-cache" shim.

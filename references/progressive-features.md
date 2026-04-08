# Progressive Features — dormant feature contract

Cortex learns the user's vault over time. Some features are valuable but would be annoying if they fired on day one. This file defines how those **dormant features** are declared, when Cortex is allowed to suggest activating them, and how the user's decision is persisted.

Loaded by `cortex-boot` during session startup (step 3 — scan for dormant-feature suggestions).

---

## Why dormant features exist

The user's `personality.md` is generated on day one during onboarding. At that moment, Cortex has no evidence of how the user actually uses the vault — only what they said they want. Some features (daily briefing, weekly review, meeting threading, knowledge extraction strictness) only pay off once the user has generated enough vault activity to make them useful.

Turning all of them on immediately would overwhelm a brand-new user. Leaving all of them off forever would make Cortex dumber than it needs to be. Dormant features solve this: they're declared at onboarding, they sit quietly until their activation signal fires, and then Cortex offers to turn them on at the next natural pause.

---

## Schema — personality.md

Dormant features live under `progressive_features` in `personality.md`. Full shape:

```yaml
progressive_features:
  active:
    - feature: "memory_management"
      activated: "2026-03-26"
      reason: "Core feature — always active"
    - feature: "inbox_processing"
      activated: "2026-03-26"
      reason: "Core feature — always active"
    # ... other core features that always ship active

  dormant:
    - feature: "meeting_threading"
      activation_signal:
        type: "count"
        scope: "meeting_notes_created_in_single_project"
        threshold: 3
        window_days: 14
      activation_prompt: >
        I've noticed you've been processing meetings for <project>. Want me to
        start threading recurring meetings (linking previous/next) automatically?
      cooldown_days: 30
    - feature: "weekly_review"
      activation_signal:
        type: "elapsed"
        scope: "days_since_vault_created"
        threshold: 21
      activation_prompt: >
        Your vault is three weeks old — want me to start generating a weekly
        review every Friday afternoon?
      cooldown_days: 14
    - feature: "daily_briefing"
      activation_signal:
        type: "count"
        scope: "active_projects_with_blockers"
        threshold: 3
      activation_prompt: >
        You have <N> active projects with open blockers. Want a daily briefing
        each morning that surfaces what needs attention?
      cooldown_days: 30
    # ... more dormant features

  suggested: []    # features Cortex has already offered; tracks cooldowns
  declined: []     # features the user explicitly declined; not re-offered for 90 days
  next_suggestion: "meeting_threading"    # pre-seeded from onboarding pain_point mapping
```

---

## Activation signal types

Signals are tiny predicates that `cortex-boot` can evaluate cheaply by reading `_changelog.txt` and the vault's folder structure. Three signal types are supported:

| Type | Meaning | Example |
|---|---|---|
| `count` | A thing has happened N times within a time window | "3 meetings processed in one project within 14 days" |
| `elapsed` | N days have passed since a known moment | "21 days since vault was created" |
| `ratio` | A fraction has crossed a threshold | "60% of active projects have open blockers" |

Each signal definition specifies:
- `type` — one of the above
- `scope` — what's being counted / measured
- `threshold` — the numeric trigger
- `window_days` (for `count` and `ratio` types) — the rolling window

Signals are evaluated **read-only** and **cheap**. If implementing a signal requires more than a grep of `_changelog.txt`, it's too expensive for per-session evaluation and should be moved to the Stage 4 MCP server's `check_dormant_features` tool instead.

---

## Suggestion timing rules

Dormant-feature suggestions are offered only at **natural pauses** in conversation. Not mid-task, not mid-sentence, not in the middle of a capture, not while the user is asking a question, not when the user is frustrated.

Concrete rules:

1. **Maximum one suggestion per session.** Even if three signals fire at once, only offer the highest-priority one. The others wait.
2. **Never interrupt.** Only surface a suggestion after the user's turn is clearly over and before the user has started a new thread.
3. **Only at Level 1 or Level 2.** Never interrupt a Level 3 focused project session with a suggestion about a different project.
4. **Never in the middle of a multi-turn workflow.** If `cortex-ingest-project` or `cortex-onboarding` is running, dormant-feature suggestions are suppressed until the workflow completes.
5. **Respect the cooldown.** If a feature was suggested and declined, do not re-suggest for `cooldown_days`. If the user said "maybe later", treat it as declined with a 14-day cooldown unless the user gave a specific date.

---

## Priority order

When multiple dormant features are ready at the same time, prefer in this order:

1. Features mapped directly to the user's stated `pain_point` from onboarding (highest priority — we already know they want this)
2. Features with the oldest `activation_signal` firing time (first-ready)
3. Features with the lowest `cooldown_days` (cheap to offer, low cost if declined)
4. Alphabetical by `feature` name (deterministic tiebreaker)

---

## Activation flow

When the user accepts a suggestion:

1. Move the feature from `dormant` to `active` in `personality.md`
2. Set `activated: <today>` and `reason: "<why — one sentence derived from the signal that fired>"`
3. Log to `_changelog.txt` as `STATUS_CHANGED`
4. Immediately apply the feature for the rest of the current session (don't make the user wait for a new session)

When the user declines:

1. Move the feature to `declined` in `personality.md` with `declined_at: <today>` and `cooldown_until: <today + cooldown_days>`
2. Log to `_changelog.txt` as `STATUS_CHANGED`
3. Do not re-offer before `cooldown_until`

---

## Default dormant-feature list (shipped by `cortex-onboarding`)

Every fresh vault ships with these features dormant:

- `meeting_threading` — threading recurring meetings with prev/next links
- `weekly_review` — Friday afternoon weekly review generation
- `daily_briefing` — morning briefing with blockers and recent activity
- `knowledge_extraction` — stricter criteria for promoting content to Knowledge Base
- `project_health` — auto-scan for stale projects and flag them
- `content_drafting` — generate first drafts for certain note types
- `goal_tracking` — quarterly goal tracker with check-ins
- `email_triage` — pipeline that sorts pulled emails into project Inboxes
- `task_sync` — bidirectional sync with Monday.com or the user's task tool

`cortex-onboarding` picks `next_suggestion` from the user's pain_point answer and maps it using the table in `workflows/onboarding.md` Question 5.

---

## Non-goals

- **No automatic activation.** Signals never activate features without user consent. Cortex always asks first.
- **No opt-out nagging.** If the user declines a feature twice, it stops being suggested for 90 days.
- **No signal chaining.** Signals are independent — activating one feature never cascades into activating another.

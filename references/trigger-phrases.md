# Trigger Phrases

**STATUS: Stub.** Canonical trigger-phrase table — populated in Stage 2 step 2 (extraction) and step 3 (per-skill rewrites). Also feeds the Stage 3 `UserPromptSubmit` hook.

## Purpose

A single source of truth for what user phrases route to what skill. Eliminates "fuzzy intent detection" — every trigger is a literal substring match or a structural signal (file shared, cwd change, etc). Used by:

1. The router hook in Stage 3 (matches phrases deterministically and injects a hint into context)
2. Each skill's `description` field (populated from this table so descriptions stay consistent)
3. The test scenarios in `tests/scenarios.md`

## Table format (to populate)

| Phrase / Signal | Routes to | Notes |
|---|---|---|
| "what's the status of X" | `cortex-check-status` | X = project name substring match |
| "log this", "log that" | `cortex-update-context` | |
| "we decided", "decision:" | `cortex-update-context` | |
| "register this repo" | `cortex-register-repo` | |
| "scan for repos" | `cortex-register-repo` | backfill mode |
| (user pastes multi-line transcript) | `cortex-process-meeting` | structural signal — length + format |
| (first message, no vault configured) | `cortex-onboarding` | hard route |
| ... | ... | ... |

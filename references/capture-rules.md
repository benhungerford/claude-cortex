# Capture Rules (Tier 1 / 2 / 3)

**STATUS: Stub.** Content being migrated from `skills/cortex/SKILL.md` `<context_capture_rules>` section in Stage 2 step 2.

## Purpose

Ambient behavior reference. Loaded by `cortex-boot` (so Claude is always watching for captures) and cited by every write-side skill (`cortex-update-context`, `cortex-process-meeting`, `cortex-knowledge`).

This replaces the dropped `cortex-capture` standalone skill — capture rules are cross-cutting, not task-triggered.

## Contents (to migrate)

- Two-question heuristic ("Would the user want to find this in six months?" / "Do I know exactly where it goes?")
- Tier 1 table (always capture — decisions, blockers, meeting outcomes, client preferences, reusable patterns)
- Tier 2 table (ask before capturing — multi-project info, contradictions, straddling knowledge, exploratory info)
- Tier 3 table (never capture — casual how-tos, debugging without patterns, brainstorming, unrelated chat)
- Capture behavior rules (don't interrupt, batch at breakpoints, brief confirmations, consolidate 3+ captures)

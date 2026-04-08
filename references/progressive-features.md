# Progressive Features

**STATUS: Stub.** New contract — to be designed during Stage 2 step 2. The monolith has a sketch of this idea but no formal schema.

## Purpose

Cortex learns the user's vault over time. Some features should only activate once the user has demonstrated they need them (e.g., meeting threading only kicks in after the user has processed 3+ meetings in the same project). This file defines the schema for those dormant features and the rules for suggesting activation at natural moments.

## Contents (to design)

- **Dormant feature schema** — what lives in `personality.md` under `progressive_features.dormant`
  - Feature name
  - Activation signal (e.g., "3+ meetings in same project within 14 days")
  - Activation prompt (how Cortex offers to turn it on)
  - Cooldown rule (don't re-ask within N days if user declined)
- **Suggestion timing rules** — only offer at natural conversational pauses, never interrupt, one suggestion per session max
- **Initial feature list** — which features ship as dormant by default (meeting threading, weekly review, knowledge extraction, progressive capture strictness, etc.)
- **Activation ledger** — where activation decisions are logged (personality.md + _changelog.txt)

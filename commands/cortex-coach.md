---
description: Adaptive skill development coaching. Reads work patterns, vault state, and learning history to surface targeted guidance. Usage:/cortex-coach [topic or question]. If no argument is given, runs a general coaching assessment. Use /cortex-coach report to generate a growth report.
---

# /cortex-coach

Invoke the `cortex-coach` skill.

**Arguments:** `$ARGUMENTS` — optional topic, question, or the keyword `report`.

**Procedure:**
1. Load `cortex-coach`.
2. If `Knowledge Base/Growth/_profile.md` does not exist: run `workflows/coach-intake.md` first.
3. If `$ARGUMENTS` is empty: run a general coaching assessment — read vault state, identify the highest-leverage growth area, and deliver guidance.
4. If `$ARGUMENTS` is `report`: run `workflows/coach-report.md` to generate a dated growth report.
5. If `$ARGUMENTS` is a non-empty string (not `report`): treat it as a topic or question and run `workflows/coach.md` with that focus.

**Failure modes:** delegate to `cortex-coach`'s failure modes table.

**Related:** `skills/cortex-coach/SKILL.md`

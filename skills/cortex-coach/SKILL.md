---
name: cortex-coach
description: Adaptive skill development coaching. Reads work patterns, vault state, and learning history — combined with Claude's expertise — to surface targeted guidance and growth opportunities. Fires on "teach me", "what should I be learning", "where can I improve", "coach me", "how could I do this better", "what am I missing", "review my approach", "skill check", or "growth check". Also runs as a scheduled task to produce dated growth reports.
---

# cortex-coach

## Purpose

A coaching layer that identifies growth opportunities from work patterns, conversation signals, and user-stated goals. Combines vault state with Claude's expertise to deliver targeted learning guidance. Learning flows bidirectionally: Cortex identifies gaps and surfaces recommendations, and the user supplies research that Cortex incorporates.

This is not a librarian (that's `cortex-knowledge`). This is a coach — it tracks what you don't know yet and helps you close the gap.

### Core Principle: Mutual Calibration

cortex-coach doesn't just help the user learn — it helps Claude learn how to help the user. As it tracks what the user struggles with, what they master, and how they prefer to be taught, that understanding persists in `_profile.md` and feeds back into every Cortex interaction. The coaching loop is a mutual calibration system where both sides get smarter over time.

## When this skill fires

**Literal triggers (on-demand):**
- "teach me", "teach me about", "teach me how", "teach me why"
- "what should I be learning", "where can I improve"
- "coach me", "how could I do this better"
- "what am I missing", "review my approach"
- "skill check", "growth check"

**Scheduled mode:**
- Invoked by a scheduled task on a user-configured interval (default: weekly)
- Produces a dated growth report to `Knowledge Base/Growth/Reports/`

See row 22 in `references/trigger-phrases.md`.

## Data Sources

cortex-coach draws from three layers:

**Layer 1 — Work Artifacts (vault reads):**
- `_changelog.txt` — work activity across projects
- Project hubs — active blockers, stages, decisions
- `Knowledge Base/` — what the user has already captured
- `Knowledge Base/Growth/_signals.log` — teaching moments logged by hooks and on-demand
- `Knowledge Base/Growth/_goals.md` — self-stated learning goals

**Layer 2 — Conversation Patterns (hook-fed):**
- The Stop hook logs entries when Claude provides significant teaching or guidance
- The UserPromptSubmit hook tags teaching-moment exchanges for the Stop hook
- Over time, these reveal recurring themes and growth areas

**Layer 3 — Claude's Expertise:**
- Claude brings training knowledge to bear on observed patterns
- Not just "you struggle with X" but "here's the concept that would unlock X"

## MCP Tool Preferences

When the `cortex-vault` MCP server is available, prefer these tools:

| Instead of... | Use MCP tool |
|---|---|
| Manually reading a project context hub | `mcp__cortex-vault__read_hub` |
| Manually enumerating projects | `mcp__cortex-vault__list_projects` |
| Manually appending to changelog | `mcp__cortex-vault__append_changelog` |
| Manually updating a MOC | `mcp__cortex-vault__update_moc` |

For vault reads/writes without a dedicated MCP tool, use Obsidian MCP tools (`mcp__obsidian__read_note`, `mcp__obsidian__write_note`, `mcp__obsidian__patch_note`).

## Procedure

**On-demand mode:** Run `workflows/coach.md`.

**Scheduled report mode:** Run `workflows/coach-report.md`.

**First run (no `_profile.md` exists):** Run `workflows/coach-intake.md` before either mode.

## Critical rules

**Always persist learning signals.** Every coaching interaction — on-demand or scheduled — logs an entry to `_signals.log`. This is silent and automatic.

**Respect learning preferences.** Always check `_profile.md` before delivering guidance. The user's preferred learning style determines the format of the output.

**Respect calibration notes.** `_profile.md` Calibration Notes describe how to interact with this specific user. Follow them.

**Don't teach what's already known.** Cross-reference Knowledge Base before recommending learning in a domain. If thorough KB articles exist, the user has likely internalized it.

**Connect to current work.** Guidance should always tie back to the user's actual projects and tasks. Not abstract theory — practical application.

**Route reusable knowledge through `cortex-knowledge`.** If coaching produces a reusable insight, hand off to `cortex-knowledge` for proper filing. Don't duplicate the Knowledge Base capture pipeline.

**Reports are reflections, not assignments.** Growth reports observe and recommend. They don't create tasks or obligations.

## Worked examples

### Example 1 — On-demand, known growth edge

```
User is working on a Shopify theme and asks: "teach me how metafields work"

Step 1: Read context.
  _profile.md shows "Shopify metafield architecture" as a Growth Edge.
  _signals.log has 3 TEACHING entries for domain:shopify, topic:metafields
  in the last 2 weeks. _goals.md has "Learn Shopify metafield patterns"
  as an active goal.

Step 2: Assess the gap.
  This is a known growth edge AND an active goal. The user has encountered
  metafields before (3 signals) but hasn't mastered them (still asking).
  This is a skill gap, not a knowledge gap.

Step 3: Deliver guidance.
  _profile.md says "hands-on walkthroughs in conversation" is the primary
  learning preference. Walk through metafield concepts using the user's
  current Shopify project as the example — their actual products, their
  actual content types.

Step 4: Log signal.
  [2026-04-11 14:30] TEACHING | domain:shopify | topic:metafield-architecture | depth:significant | mode:on-demand

Step 5: Route knowledge.
  The walkthrough produced a reusable pattern ("Shopify metafield naming
  conventions for content types"). Invoke cortex-knowledge to file it.
  Confirm: "Extracted 'Shopify metafield naming conventions' to Knowledge Base."
```

### Example 2 — On-demand, new territory

```
User is debugging a CSS issue and asks: "what am I missing here?"

Step 1: Read context.
  _profile.md lists "CSS layout (solid, not expert)" under Strengths.
  _signals.log has 1 minor TEACHING entry for CSS in the last month.
  No active goal related to CSS.

Step 2: Assess the gap.
  This is not a tracked growth edge — the user is generally competent
  at CSS. The question is situational, not a pattern. Assess the specific
  problem they're facing.

Step 3: Deliver guidance.
  Help with the specific issue. Since it's a one-off, keep it practical.
  If the solution reveals a deeper concept worth learning (e.g., stacking
  contexts, specificity rules), mention it briefly.

Step 4: Log signal.
  [2026-04-11 15:00] GUIDANCE | domain:css | topic:specificity | depth:minor | mode:on-demand

Step 5: Route knowledge.
  The fix was project-specific (a z-index conflict in their theme).
  Reusability test: no. Don't file to KB.
```

### Example 3 — Scheduled growth report

```
Scheduled task fires on Friday.

Step 1: Last report was 2026-04-04. Period: 2026-04-04 to 2026-04-11.

Step 2: Aggregate signals.
  12 entries in _signals.log for the period:
  - domain:shopify — 5 entries (3 TEACHING, 2 GUIDANCE)
  - domain:liquid — 4 entries (2 TEACHING, 2 STRUGGLE)
  - domain:css — 2 entries (1 TEACHING, 1 GUIDANCE)
  - domain:git — 1 entry (GUIDANCE)

Step 3: Vault context.
  Changelog: 28 entries, mostly FKT project. 2 new KB articles
  (both Shopify-related). Goals: "Liquid templating" and "Shopify
  metafield patterns" are active.

Step 4: Analysis.
  - Liquid is the hot spot — 4 signals including 2 STRUGGLE entries.
    This aligns with the active goal.
  - Shopify signals are high but mostly TEACHING (learning new things)
    rather than STRUGGLE (hitting walls). Good trajectory.
  - CSS and git are incidental, not patterns.

Step 5: Write report to Knowledge Base/Growth/Reports/2026-04-11 Growth Report.md.

Step 6: Update _profile.md:
  - Growth Edges: "Liquid templating" stays (high signal, STRUGGLE entries)
  - Growth Edges: "Shopify metafield architecture" improving (TEACHING trending down)
  - Calibration: add "Liquid is the highest-leverage teaching domain right now"
```

### Example 4 — First run

```
User: "coach me on how to get better"

Pre-check: _profile.md does not exist → run workflows/coach-intake.md.

Step 2: Ask goals.
  "What are 2-3 things you'd like to get better at in your work?"
  User: "Liquid templating, I always lean on Claude for it. Also metafields."

Step 3: Write _goals.md with those goals.

Step 4: Ask preferences.
  "How do you prefer to learn?"
  User: "Walk me through things in conversation, I learn by doing."

Step 5: Bootstrap from vault.
  KB has 8 articles — 5 WordPress, 2 Shopify, 1 Obsidian.
  Changelog: mostly Shopify and WordPress activity.
  personality.md: web developer, Shopify + WordPress focus.
  → Strengths: WordPress theme development, Shopify storefront basics.
  → Growth Edges: Liquid templating, Shopify metafield architecture.

Step 6: Write _profile.md.

Step 7: Confirm: "Growth tracking set up. Profile bootstrapped."

Step 8: Immediately deliver first guidance on Liquid templating
  (the user's stated #1 goal).
```

## Failure modes

| Failure | What to do |
|---|---|
| `Knowledge Base/Growth/` folder doesn't exist | Run `workflows/coach-intake.md` to scaffold it. |
| `_profile.md` exists but `_goals.md` doesn't | Create a minimal `_goals.md` with empty Active Goals. Ask the user if they want to set goals. |
| `_signals.log` is empty (new installation, no history) | Deliver guidance based on vault state and Claude's expertise alone. Note in response: "As you use Cortex more, coaching will get more targeted." |
| `_signals.log` is very large (1000+ entries) | Read only the last 90 days of entries for analysis. Older signals represent past state, not current. |
| User asks for coaching on a topic unrelated to their work | Deliver the guidance. Not everything needs to connect to an active project. Log the signal with the appropriate domain. |
| Scheduled report finds no signals in the period | Write a short report noting the quiet period. Suggest the user invoke coaching on-demand when they want guidance. Don't fabricate patterns. |
| User's learning preferences are not set | Default to conversational walkthroughs (the most interactive mode). Suggest setting preferences: "Want me to tailor how I teach you? Tell me your preferred learning style." |
| Coaching guidance contradicts an existing KB article | Flag both versions. The KB article may be outdated, or the coaching may be wrong. Let the user decide. |

## What this skill does NOT do

- Does not replace `cortex-knowledge`. Knowledge capture is a separate skill.
- Does not assign homework. Reports are reflections, not assignments.
- Does not modify `personality.md`. The learner profile is `_profile.md`.
- Does not interrupt the user. On-demand mode is always user-initiated. Scheduled mode writes silently.
- Does not hardcode learning resources. Claude recommends from its expertise; the user decides what to pursue.
- Does not grade or evaluate the user. It observes patterns and suggests directions.

## Related

- **Workflows:** `workflows/coach.md`, `workflows/coach-report.md`, `workflows/coach-intake.md`
- **References:** `references/trigger-phrases.md` (row 22), `references/vault-conventions.md`
- **Handoff targets:** `cortex-knowledge` (reusable guidance), `cortex-update-context` (project-specific insights)
- **Data files:** `Knowledge Base/Growth/_profile.md`, `Knowledge Base/Growth/_goals.md`, `Knowledge Base/Growth/_signals.log`
- **Hooks:** Stop hook (signal logging), UserPromptSubmit (teaching-moment tagging), PostToolUse (intake tagging)
- **Triggers:** row 22 in `references/trigger-phrases.md`

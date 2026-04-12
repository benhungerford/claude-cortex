# cortex-coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an adaptive coaching layer to Cortex that identifies growth opportunities from work patterns, conversation signals, and user goals — combining vault state with Claude's expertise to deliver targeted learning guidance.

**Architecture:** A new core skill (`cortex-coach`) with two modes: on-demand (invoked mid-conversation) and scheduled (writes dated growth reports). Three hook enhancements feed it conversation pattern data. All coaching output lives under `Knowledge Base/Growth/` in the vault.

**Tech Stack:** Bash hooks, Python (boot-context.py additions), SKILL.md, Obsidian MCP tools, scheduled tasks

**Spec:** `docs/superpowers/specs/2026-04-11-cortex-coach-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| **Create:** `skills/cortex-coach/SKILL.md` | Skill definition — triggers, procedure, rules, examples |
| **Create:** `workflows/coach.md` | Core coaching workflow — analysis, guidance, persistence |
| **Create:** `workflows/coach-report.md` | Scheduled report workflow — aggregation, report writing, profile updates |
| **Create:** `workflows/coach-intake.md` | First-run intake workflow — goals, preferences, bootstrap |
| **Create:** `commands/cortex-coach.md` | Command alias for `/cortex-coach` |
| **Modify:** `references/trigger-phrases.md` | Add row 22 with cortex-coach triggers |
| **Modify:** `hooks/user-prompt-submit` | Add teaching-moment detection (section 3e-new) |
| **Modify:** `hooks/stop` | Add learning signal logging to `_signals.log` |
| **Modify:** `hooks/post-tool-use` | Add learning intake tagging for KB writes |
| **Modify:** `hooks/lib/boot-context.py` | Load `_profile.md` into session context |
| **Modify:** `hooks/session-start` | Include `_profile.md` content in session block |
| **Modify:** `tests/scenarios.md` | Add scenarios 11-13 for cortex-coach |

---

### Task 1: Add trigger phrases to routing table

**Files:**
- Modify: `references/trigger-phrases.md:41` (add row 22 after cortex-extend row)

- [ ] **Step 1: Add cortex-coach triggers to the routing table**

Add a new row 22 after the existing row 21 (cortex-extend). Insert this between the cortex-extend row and the `---` separator:

```markdown
| 22 | Literal: "teach me", "teach me about", "teach me how", "teach me why", "what should I be learning", "where can I improve", "coach me", "how could I do this better", "what am I missing", "review my approach", "skill check", "growth check" | `cortex-coach` | On-demand coaching. Reads vault state + Claude expertise to deliver tailored guidance. |
```

- [ ] **Step 2: Verify no disambiguation conflicts**

Check the existing routing table for overlaps. "teach" does not conflict with any existing trigger. "review my approach" does not overlap with "what's the status of" (row 5). "what am I missing" is unique. No disambiguation rule updates needed.

- [ ] **Step 3: Commit**

```bash
git add references/trigger-phrases.md
git commit -m "feat(coach): add cortex-coach triggers to routing table (row 22)"
```

---

### Task 2: Create the coach intake workflow

**Files:**
- Create: `workflows/coach-intake.md`

- [ ] **Step 1: Create the intake workflow**

```markdown
<required_reading>
**Read these reference files NOW:**
1. personality.md (in vault root — provides identity, mental_model, tools context)
2. references/vault-conventions.md (frontmatter, wikilinks, MOC rules)
</required_reading>

<process>

**When to trigger:** First invocation of cortex-coach when `Knowledge Base/Growth/_profile.md` does not exist.

**Step 1: Scaffold the Growth folder**

Create the folder structure under `Knowledge Base/Growth/`:

a. Create `Knowledge Base/Growth/_MOC.md`:

```yaml
---
created: {{now}}
updated: {{now}}
tags:
  - "#type/moc"
---
```

```markdown
# Growth — Map of Content

> Adaptive skill development tracking. Goals, learning signals, growth reports, and learner profile.

## Core Files
- [[_goals]] — Active and completed learning goals
- [[_profile]] — Learner profile (strengths, growth edges, preferences, calibration)

## Reports
<!-- Growth reports will be added here chronologically -->
```

b. Create `Knowledge Base/Growth/_signals.log` as an empty file.

c. Update `Knowledge Base/_MOC.md` to include a link to `Growth/_MOC`:
   - Add `- [[Growth/_MOC|Growth]] — Adaptive skill development tracking` under an appropriate section.

**Step 2: Ask about learning goals**

Ask the user:
> "What are 2-3 things you'd like to get better at in your work? These can be technical skills, workflow habits, or domain knowledge."

Wait for the user's response.

**Step 3: Write _goals.md**

Create `Knowledge Base/Growth/_goals.md`:

```yaml
---
created: {{now}}
updated: {{now}}
tags:
  - "#type/knowledge"
  - "#domain/growth"
---
```

```markdown
# Learning Goals

## Active Goals
{{For each goal the user mentioned, write a checkbox item:}}
- [ ] {{Goal description — in the user's own words}}

## Completed
<!-- Goals move here when mastered, with completion date -->
```

**Step 4: Ask about learning preferences**

Ask the user:
> "How do you prefer to learn new things? For example: reading articles or docs, watching videos, hands-on walkthroughs in conversation, studying code examples, or a mix depending on the topic?"

Wait for the user's response.

**Step 5: Bootstrap profile from vault state**

Before writing `_profile.md`, scan the vault to infer initial state:

a. Read `Knowledge Base/_MOC.md` — what domains have existing articles? These are likely strengths.
b. Read `_changelog.txt` (last 50 entries) — what domains has the user been working in recently?
c. Read personality.md — what projects are active? What's the user's role and focus?

Use these signals to draft an initial Strengths section and Growth Edges section.

**Step 6: Write _profile.md**

Create `Knowledge Base/Growth/_profile.md`:

```yaml
---
created: {{now}}
updated: {{now}}
tags:
  - "#type/knowledge"
  - "#domain/growth"
  - "#status/evergreen"
---
```

```markdown
# Learner Profile

## Learning Preferences
{{Write the user's stated preferences from Step 4}}

## Strengths
{{Inferred from vault state — list domains with existing KB articles, frequent changelog activity}}

## Growth Edges
{{Inferred from goals + vault gaps — list 2-3 areas where the user wants to grow}}

## Calibration Notes
{{Initial entry based on any conversation style observations. If none yet, write:}}
- Initial profile — calibration notes will develop over time as coaching interactions accumulate.
```

**Step 7: Log and confirm**

- Log each created file to `_changelog.txt` via the post-tool-use hook (automatic).
- Confirm: "Growth tracking set up. Profile bootstrapped from your vault. Ready to coach."

**Step 8: Deliver first guidance**

Immediately transition to the main coaching workflow (`workflows/coach.md`) to deliver the user's first piece of guidance based on what was just learned. Do not end the intake without providing value.

</process>
```

- [ ] **Step 2: Commit**

```bash
git add workflows/coach-intake.md
git commit -m "feat(coach): add first-run intake workflow"
```

---

### Task 3: Create the core coaching workflow

**Files:**
- Create: `workflows/coach.md`

- [ ] **Step 1: Create the on-demand coaching workflow**

```markdown
<required_reading>
**Read these reference files NOW:**
1. personality.md (in vault root)
2. Knowledge Base/Growth/_profile.md (learner profile — preferences, strengths, growth edges, calibration)
3. Knowledge Base/Growth/_goals.md (active learning goals)
4. references/vault-conventions.md (frontmatter, wikilinks)
</required_reading>

<process>

**When to trigger:** User invokes cortex-coach on-demand (trigger phrases from row 22 of trigger-phrases.md).

**Pre-check:** If `Knowledge Base/Growth/_profile.md` does not exist, run `workflows/coach-intake.md` first.

**Step 1: Read context**

a. Read `Knowledge Base/Growth/_profile.md` — learning preferences, strengths, growth edges, calibration notes.
b. Read `Knowledge Base/Growth/_goals.md` — active learning goals.
c. Read `Knowledge Base/Growth/_signals.log` — recent teaching moments (last 30 entries). Look for domain clusters and recurring topics.
d. Identify the current conversation context — what is the user working on right now? What project, what domain, what problem?

**Step 2: Assess the gap**

Using the data from Step 1, determine:

a. **Is this a known growth edge?** Does the current topic align with something in `_profile.md` Growth Edges or `_goals.md` Active Goals?
b. **Is this a knowledge gap or a skill gap?**
   - Knowledge gap: the user has never encountered this concept. Signals: no KB articles on the topic, no signals in `_signals.log` for this domain.
   - Skill gap: the user has encountered it but hasn't mastered it. Signals: multiple `TEACHING` or `STRUGGLE` entries for this domain in `_signals.log`.
c. **What's the highest-leverage thing to teach?** Given what the user is trying to accomplish right now, what single concept or technique would have the most impact?
d. **What does the user already know?** Check Knowledge Base for existing articles in this domain. Don't teach what's already internalized.

**Step 3: Deliver guidance**

Tailor the delivery to the user's learning preferences from `_profile.md`:

- **Walkthroughs** → Teach inline. Walk through the concept step by step using the user's current work as the example. Offer to go deeper if they want.
- **Articles/docs** → Point to specific external resources (documentation pages, tutorials). Summarize the key insight so they know what to look for. Use Claude's knowledge to recommend the most relevant resource.
- **Code examples** → Build a concrete, working example grounded in the user's actual project. Not abstract — use their file names, their data structures, their problem.
- **Mix / topic-dependent** → Choose the mode that fits this specific topic based on any per-domain preferences in `_profile.md`.

Always connect guidance back to the user's actual project. Not abstract theory — practical application.

Respect the calibration notes in `_profile.md`. If it says "prefers terse explanations", don't over-explain. If it says "lead with a recommendation", don't present 5 options.

**Step 4: Persist learning signal**

After delivering guidance, append an entry to `Knowledge Base/Growth/_signals.log`:

```
[{{YYYY-MM-DD HH:MM}}] {{SIGNAL_TYPE}} | domain:{{domain}} | topic:{{topic}} | depth:{{significant|minor}} | mode:on-demand
```

Signal types:
- `TEACHING` — explained something the user didn't know
- `GUIDANCE` — suggested a better approach to something the user was already doing

This logging is silent — do not mention it to the user.

**Step 5: Route reusable knowledge**

Apply the reusability test from `cortex-knowledge`:

> "Is this project-specific or would it help on a different project?"

If reusable → invoke `cortex-knowledge` to file the guidance as a Knowledge Base article. One-line confirmation.

If project-specific → no action needed. The guidance lives in the conversation and in `_signals.log`.

</process>
```

- [ ] **Step 2: Commit**

```bash
git add workflows/coach.md
git commit -m "feat(coach): add on-demand coaching workflow"
```

---

### Task 4: Create the scheduled report workflow

**Files:**
- Create: `workflows/coach-report.md`

- [ ] **Step 1: Create the report workflow**

```markdown
<required_reading>
**Read these reference files NOW:**
1. personality.md (in vault root)
2. Knowledge Base/Growth/_profile.md (learner profile)
3. Knowledge Base/Growth/_goals.md (active learning goals)
4. Knowledge Base/Growth/_signals.log (teaching moment history)
5. references/vault-conventions.md (frontmatter, wikilinks)
</required_reading>

<process>

**When to trigger:** Scheduled task invokes cortex-coach in report mode, or user explicitly asks for a growth report.

**Pre-check:** If `Knowledge Base/Growth/_profile.md` does not exist, run `workflows/coach-intake.md` first.

**Step 1: Determine report period**

a. Check `Knowledge Base/Growth/Reports/` for the most recent report. The new report period starts the day after the last report ended.
b. If no previous reports exist, use the last 7 days as the default period.

**Step 2: Aggregate signals**

a. Read `Knowledge Base/Growth/_signals.log`. Filter to entries within the report period.
b. Group signals by domain. Count frequency per domain.
c. Identify clusters — domains with 3+ signals are notable.
d. Identify signal type distribution — is the user mostly getting `TEACHING` (new concepts) or `GUIDANCE` (approach improvement) or `STRUGGLE` (repeated difficulty)?

**Step 3: Read vault context**

a. Read `_changelog.txt` — filter to the report period. What domains did the user work in? Any new project types or unfamiliar territory?
b. Read `Knowledge Base/_MOC.md` — what articles were created or updated during the period? These represent knowledge the user has internalized.
c. Read `Knowledge Base/Growth/_goals.md` — what are the active goals?
d. Read `Knowledge Base/Growth/_profile.md` — current strengths, growth edges, calibration.

**Step 4: Analyze and draft**

Cross-reference signals, changelog activity, KB articles, and goals to identify:

a. **Patterns observed** — What domains did the user work in most? Where did Claude provide the most guidance? Any surprising patterns?
b. **Progress on goals** — For each active goal, what evidence exists of progress? Signal frequency declining (mastery) or increasing (active learning)? New KB articles in the goal's domain?
c. **Growth edges** — 2-3 specific areas where targeted learning would have the highest impact right now. Why each one matters for the user's current work. Recommended next steps tailored to learning preferences from `_profile.md`.
d. **Profile updates** — Any observations that should update `_profile.md`? A growth edge that's now a strength? A new growth edge emerging? Calibration notes to refine?

**Step 5: Write the report**

Create `Knowledge Base/Growth/Reports/{{YYYY-MM-DD}} Growth Report.md`:

```yaml
---
created: {{now}}
updated: {{now}}
type: growth-report
period: {{start_date}} to {{end_date}}
tags:
  - "#type/growth-report"
  - "#source/cortex-coach"
---
```

```markdown
# Growth Report — {{start_date}} to {{end_date}}

## Patterns Observed
{{What domains the user worked in, what came up repeatedly, where Claude provided the most guidance}}

## Progress on Goals
{{Status against each active goal in _goals.md, with evidence from signals and artifacts}}

## Growth Edges
{{2-3 specific areas with highest learning impact, why they matter, recommended next steps}}

## Profile Updates
{{Any changes being made to _profile.md based on this period}}

---
*Related:* [[_MOC]]
```

**Step 6: Update profile**

Read the current `_profile.md` and apply any updates identified in Step 4d:
- Move mastered growth edges to Strengths (with date)
- Add newly identified growth edges
- Refine calibration notes based on observed patterns
- Update the `updated` field in frontmatter

**Step 7: Update Growth MOC**

Add the new report to `Knowledge Base/Growth/_MOC.md` under the Reports section:

```markdown
- [[{{YYYY-MM-DD}} Growth Report]] — {{one-line summary of key finding}}
```

**Step 8: Log and confirm**

- Changelog entries are auto-logged by post-tool-use hook.
- If running as a scheduled task (non-interactive): write the report silently. The user will find it in their vault.
- If running interactively: confirm with one line: "Growth report written for {{period}}. Key finding: {{one-line summary}}."

</process>
```

- [ ] **Step 2: Commit**

```bash
git add workflows/coach-report.md
git commit -m "feat(coach): add scheduled growth report workflow"
```

---

### Task 5: Create the cortex-coach SKILL.md

**Files:**
- Create: `skills/cortex-coach/SKILL.md`

- [ ] **Step 1: Create the skill directory and SKILL.md**

```bash
mkdir -p skills/cortex-coach
```

Write `skills/cortex-coach/SKILL.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add skills/cortex-coach/SKILL.md
git commit -m "feat(coach): add cortex-coach skill definition"
```

---

### Task 6: Create the command alias

**Files:**
- Create: `commands/cortex-coach.md`

- [ ] **Step 1: Create the command alias**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add commands/cortex-coach.md
git commit -m "feat(coach): add /cortex-coach command alias"
```

---

### Task 7: Enhance UserPromptSubmit hook — teaching moment tagger

**Files:**
- Modify: `hooks/user-prompt-submit` (add section 3e-coach between existing 3e knowledge triggers and 3f read-side triggers)

- [ ] **Step 1: Add cortex-coach trigger detection to user-prompt-submit**

Add a new case block between the existing `# ── 3e: Knowledge triggers` section and the `# ── 3f: Read-side triggers` section. Insert this new section:

```bash
# ── 3e-coach: Coaching triggers ─────────────────────────────────────────────
if [[ -z "$SKILL" ]]; then
    case "$LOWER" in
        *"teach me"*|*"coach me"*|*"what should i be learning"*|*"where can i improve"*|*"how could i do this better"*|*"what am i missing"*|*"review my approach"*|*"skill check"*|*"growth check"*)
            SKILL="cortex-coach"
            CONFIDENCE="high"
            TRIGGER_DESC="coaching trigger"
            ;;
    esac
fi
```

Also add a **teaching moment tagger** — a separate detection that doesn't route to a skill but injects a hint for the Stop hook. Add this **after all skill routing** (after the `# ── Step 4: Output` section header but before the skill output logic):

```bash
# ── Step 3b: Teaching moment detection (for Stop hook signal logging) ───────
# This does NOT route to a skill. It tags the exchange so the Stop hook
# can log learning signals.

TEACHING_HINT=""
if [[ -z "$SKILL" ]]; then
    case "$LOWER" in
        *"explain"*|*"why does"*|*"how does"*|*"walk me through"*|*"help me understand"*|*"what's the difference between"*|*"show me how"*)
            TEACHING_HINT="<cortex-hint type=\"teaching-moment\">Teaching moment detected — stop hook should log if Claude provides significant instruction.</cortex-hint>"
            ;;
    esac
fi
```

Then modify the output section to include `TEACHING_HINT` when present. Replace the final output block. The current logic checks `if [[ -z "$SKILL" ]]` and exits. Change it to also check for `TEACHING_HINT`:

```bash
# ── Step 4: Output ──────────────────────────────────────────────────────────

if [[ -z "$SKILL" && -z "$TEACHING_HINT" ]]; then
    printf '{}\n'
    exit 0
fi

HINT=""
if [[ -n "$SKILL" ]]; then
    HINT="<cortex-hint>likely-skill: $SKILL | confidence: $CONFIDENCE | trigger: \"$TRIGGER_DESC\"</cortex-hint>"
fi

if [[ -n "$TEACHING_HINT" ]]; then
    HINT="${HINT}${TEACHING_HINT}"
fi

ESCAPED="$(escape_for_json "$HINT")"
```

The rest of the platform-detection output code remains unchanged.

- [ ] **Step 2: Test the hook manually**

```bash
echo '{"user_prompt":"teach me about Liquid filters"}' | bash hooks/user-prompt-submit
```

Expected: JSON output containing `cortex-coach` skill hint.

```bash
echo '{"user_prompt":"explain why this CSS selector is more specific"}' | bash hooks/user-prompt-submit
```

Expected: JSON output containing `teaching-moment` hint (not a skill route).

```bash
echo '{"user_prompt":"fix this bug for me"}' | bash hooks/user-prompt-submit
```

Expected: `{}` (no match).

- [ ] **Step 3: Commit**

```bash
git add hooks/user-prompt-submit
git commit -m "feat(coach): add coaching triggers and teaching-moment tagger to user-prompt-submit hook"
```

---

### Task 8: Enhance Stop hook — learning signal logger

**Files:**
- Modify: `hooks/stop`

- [ ] **Step 1: Add learning signal logging to the stop hook**

The current stop hook flushes pending memory updates. Add a new section **before** the memory flush (after Step 1 / loop prevention check, before Step 2) that checks for teaching-moment hints from the session and logs them to `_signals.log`.

Add this new section after the `STOP_ACTIVE` check:

```bash
# ── Step 1b: Log learning signals to _signals.log ───────────────────────────
# Check for teaching-moment flags written during the session.
# The UserPromptSubmit hook writes teaching-moment hints, and the session
# context may contain <cortex-hint type="teaching-moment"> tags.
# We check for a session-level teaching signal file that the model writes.

SIGNALS_PENDING="$PLUGIN_DATA/session-cache/pending-signals.json"

if [[ -f "$SIGNALS_PENDING" && -s "$SIGNALS_PENDING" ]]; then
    # Resolve vault path
    SIGNAL_CACHE_FILE="$PLUGIN_DATA/session-cache/vault-path.txt"
    SIGNAL_VAULT_PATH=""

    if [[ -f "$SIGNAL_CACHE_FILE" ]]; then
        SIGNAL_VAULT_PATH="$(cat "$SIGNAL_CACHE_FILE")"
    fi

    if [[ -n "$SIGNAL_VAULT_PATH" && -d "$SIGNAL_VAULT_PATH" ]]; then
        SIGNALS_LOG="$SIGNAL_VAULT_PATH/Knowledge Base/Growth/_signals.log"

        # Only write if the Growth folder exists (coach has been initialized)
        if [[ -d "$SIGNAL_VAULT_PATH/Knowledge Base/Growth" ]]; then
            python3 -c "
import json, sys, os
from datetime import datetime

pending_file = sys.argv[1]
signals_log = sys.argv[2]

try:
    with open(pending_file) as f:
        signals = json.load(f)
except Exception:
    sys.exit()

if not isinstance(signals, list) or len(signals) == 0:
    sys.exit()

with open(signals_log, 'a') as f:
    for sig in signals:
        ts = sig.get('timestamp', datetime.now().strftime('%Y-%m-%d %H:%M'))
        sig_type = sig.get('type', 'TEACHING')
        domain = sig.get('domain', 'unknown')
        topic = sig.get('topic', 'unknown')
        depth = sig.get('depth', 'minor')
        mode = sig.get('mode', 'session')
        f.write(f'[{ts}] {sig_type} | domain:{domain} | topic:{topic} | depth:{depth} | mode:{mode}\n')
" "$SIGNALS_PENDING" "$SIGNALS_LOG" 2>/dev/null || true
        fi
    fi

    rm -f "$SIGNALS_PENDING"
fi
```

- [ ] **Step 2: Test the signal logging**

Create a test pending-signals file and run the hook:

```bash
mkdir -p ~/.claude/cortex/plugin-data/session-cache
echo '[{"type":"TEACHING","domain":"liquid","topic":"conditional-filters","depth":"significant","mode":"session"}]' > ~/.claude/cortex/plugin-data/session-cache/pending-signals.json
echo '{"stop_hook_active": false}' | bash hooks/stop
```

Expected: If `Knowledge Base/Growth/_signals.log` exists in the vault, the signal entry is appended. Clean up the test file after.

- [ ] **Step 3: Commit**

```bash
git add hooks/stop
git commit -m "feat(coach): add learning signal logger to stop hook"
```

---

### Task 9: Enhance PostToolUse hook — learning intake tagger

**Files:**
- Modify: `hooks/post-tool-use`

- [ ] **Step 1: Add source tagging for Knowledge Base writes**

In the existing post-tool-use hook, after Step 6 (infer action type) and before Step 7 (compute relative path), add a check that detects whether the file being written is inside `Knowledge Base/`. If it is, append a source tag to the changelog note.

Add this section after the `ACTION` assignment:

```bash
# ── Step 6b: Detect Knowledge Base writes for learning intake tagging ────────

KB_SOURCE=""
case "$REL_PATH" in
    "Knowledge Base/"*)
        # Check if this write was initiated by cortex-coach
        COACH_FLAG="$PLUGIN_DATA/session-cache/coach-active.flag"
        if [[ -f "$COACH_FLAG" ]]; then
            KB_SOURCE=" [source:coaching]"
        else
            KB_SOURCE=" [source:capture]"
        fi
        ;;
esac
```

Then modify the Step 8 changelog entry to include the tag. Change the `ENTRY` line:

```bash
ENTRY="[$TIMESTAMP] $ACTION [auto] | FILE: $FILENAME | DEST: $REL_DIR | NOTE: Auto-logged by hook${KB_SOURCE}"
```

- [ ] **Step 2: Commit**

```bash
git add hooks/post-tool-use
git commit -m "feat(coach): add learning intake tagging to post-tool-use hook"
```

---

### Task 10: Enhance boot-context.py — load learner profile

**Files:**
- Modify: `hooks/lib/boot-context.py`

- [ ] **Step 1: Add a function to read the learner profile**

Add this function after the existing `read_memory` function (around line 52):

```python
def read_learner_profile(vault_path):
    """Read Knowledge Base/Growth/_profile.md. Returns content string or empty."""
    path = os.path.join(vault_path, "Knowledge Base", "Growth", "_profile.md")
    if not os.path.isfile(path):
        return ""
    with open(path) as f:
        return f.read()
```

- [ ] **Step 2: Call the function in main()**

In the `main()` function, after the `memory = read_memory(...)` line (around line 257), add:

```python
    learner_profile = read_learner_profile(vault_path)
```

- [ ] **Step 3: Include learner_profile in the output JSON**

In the `output` dict construction (around line 282), add the field:

```python
        "learner_profile": learner_profile,
```

- [ ] **Step 4: Commit**

```bash
git add hooks/lib/boot-context.py
git commit -m "feat(coach): load learner profile in boot-context.py"
```

---

### Task 11: Enhance session-start — include profile in session block

**Files:**
- Modify: `hooks/session-start`

- [ ] **Step 1: Add learner profile to the session block builder**

In the Python block that builds the `SESSION_BLOCK` (the inline Python script in session-start), add a new section after the `</cortex-memory>` line and before the `recent_activity` check. Add these lines to the inline Python:

```python
lp = data.get('learner_profile', '')
if lp.strip():
    lines.append('')
    lines.append('<cortex-learner-profile>')
    lines.append(lp.rstrip())
    lines.append('</cortex-learner-profile>')
```

This ensures `_profile.md` content is available in the session context from the first message, enabling the mutual calibration loop — Claude's behavior is informed by the learner profile even outside of coaching interactions.

- [ ] **Step 2: Commit**

```bash
git add hooks/session-start
git commit -m "feat(coach): include learner profile in session block"
```

---

### Task 12: Add test scenarios

**Files:**
- Modify: `tests/scenarios.md`

- [ ] **Step 1: Add cortex-coach test scenarios**

Append three new scenarios to the end of `tests/scenarios.md`:

```markdown
---

## Scenario 11 — First-run coaching → `cortex-coach` intake

**Trigger phrase(s) or structural signal:** Literal. "coach me on how to get better". Row 22 of the routing table.

**Pre-conditions:**
- Baseline vault state.
- `Knowledge Base/Growth/` folder does **not** exist.
- `Knowledge Base/Growth/_profile.md` does **not** exist.
- cwd is `~/Documents` (neutral, L1 session).

**User input:** `coach me on how to get better`

**Expected routing:** `cortex-coach` → detects missing `_profile.md` → runs `workflows/coach-intake.md`.

**Expected behavior:**
1. Skill scaffolds `Knowledge Base/Growth/` with `_MOC.md`, `_signals.log`.
2. Asks the user about learning goals. Waits for response.
3. Writes `_goals.md` with user's stated goals.
4. Asks the user about learning preferences. Waits for response.
5. Bootstraps `_profile.md` from vault state (KB articles, changelog, personality.md).
6. Writes `_profile.md` with preferences, inferred strengths, growth edges.
7. Delivers first piece of coaching guidance based on the user's #1 goal.

**Expected vault mutations:**
- Created: `Knowledge Base/Growth/_MOC.md`
- Created: `Knowledge Base/Growth/_signals.log`
- Created: `Knowledge Base/Growth/_goals.md`
- Created: `Knowledge Base/Growth/_profile.md`
- Updated: `Knowledge Base/_MOC.md` (added Growth link)
- Appended: `Knowledge Base/Growth/_signals.log` (first coaching signal)
- Appended: `_changelog.txt` (auto-logged by hook for each created file)

**Expected chat output:** Goals question → preferences question → "Growth tracking set up." → first coaching guidance.

**Failure mode to exercise:** Run the same scenario again after intake completes. The skill should skip intake (profile exists) and go straight to coaching.

---

## Scenario 12 — On-demand coaching with existing profile → `cortex-coach`

**Trigger phrase(s) or structural signal:** Literal. "teach me about Liquid filters". Row 22 of the routing table.

**Pre-conditions:**
- Baseline vault state.
- `Knowledge Base/Growth/_profile.md` exists with learning preferences set to "walkthroughs".
- `Knowledge Base/Growth/_goals.md` exists with "Liquid templating" as an active goal.
- `Knowledge Base/Growth/_signals.log` has 2 prior TEACHING entries for domain:liquid.
- cwd is inside a Shopify project repo (L3 session).

**User input:** `teach me about Liquid filters`

**Expected routing:** `cortex-coach` → profile exists → runs `workflows/coach.md`.

**Expected behavior:**
1. Reads `_profile.md`, `_goals.md`, `_signals.log`.
2. Identifies Liquid as a known growth edge and active goal.
3. Identifies this as a skill gap (prior signals exist, user is still asking).
4. Delivers walkthrough-style guidance (matching learning preference) using the user's current Shopify project as the example.
5. Silently appends a TEACHING signal to `_signals.log`.
6. Applies reusability test to any knowledge produced.

**Expected vault mutations:**
- Appended: `Knowledge Base/Growth/_signals.log` (new TEACHING entry with mode:on-demand)
- Possibly created: a new Knowledge Base article (if guidance was reusable)

**Expected chat output:** Walkthrough of Liquid filters with concrete examples from the user's project. No mention of signal logging.

**Failure mode to exercise:** Delete `_goals.md` before running. The skill should create a minimal `_goals.md` and ask the user if they want to set goals.

---

## Scenario 13 — Scheduled growth report → `cortex-coach` report mode

**Trigger phrase(s) or structural signal:** Explicit invocation via `/cortex-coach report` or scheduled task.

**Pre-conditions:**
- Baseline vault state.
- `Knowledge Base/Growth/` fully set up (profile, goals, signals).
- `Knowledge Base/Growth/_signals.log` has 10+ entries spanning the last 7 days across 3 domains.
- `Knowledge Base/Growth/Reports/` exists but is empty (first report).

**User input:** `/cortex-coach report`

**Expected routing:** `cortex-coach` → `report` argument → runs `workflows/coach-report.md`.

**Expected behavior:**
1. Determines report period (last 7 days, since no previous report exists).
2. Aggregates signals by domain, counts frequency, identifies clusters.
3. Reads changelog, KB articles, goals, profile for context.
4. Writes a dated growth report to `Knowledge Base/Growth/Reports/`.
5. Updates `_profile.md` with any new observations.
6. Updates `Knowledge Base/Growth/_MOC.md` with the new report link.

**Expected vault mutations:**
- Created: `Knowledge Base/Growth/Reports/2026-04-11 Growth Report.md`
- Updated: `Knowledge Base/Growth/_profile.md` (profile updates section applied)
- Updated: `Knowledge Base/Growth/_MOC.md` (new report link)
- Appended: `_changelog.txt` (auto-logged)

**Expected chat output:** "Growth report written for 2026-04-04 to 2026-04-11. Key finding: {{one-line summary}}."

**Failure mode to exercise:** Empty `_signals.log` before running. The skill should write a short report noting the quiet period without fabricating patterns.
```

- [ ] **Step 2: Commit**

```bash
git add tests/scenarios.md
git commit -m "feat(coach): add test scenarios 11-13 for cortex-coach"
```

---

### Task 13: Version bump and final commit

**Files:**
- Modify: `.claude-plugin/plugin.json`

- [ ] **Step 1: Bump the plugin version**

Update the version in `.claude-plugin/plugin.json` from `"1.1.0"` to `"1.2.0"` (minor bump for new feature).

- [ ] **Step 2: Commit**

```bash
git add .claude-plugin/plugin.json
git commit -m "chore: bump version to v1.2.0 for cortex-coach"
```

---

### Task 14: End-to-end verification

- [ ] **Step 1: Verify all files exist**

```bash
ls -la skills/cortex-coach/SKILL.md
ls -la workflows/coach.md
ls -la workflows/coach-report.md
ls -la workflows/coach-intake.md
ls -la commands/cortex-coach.md
```

All five files should exist.

- [ ] **Step 2: Verify hook modifications**

```bash
# Test user-prompt-submit routing
echo '{"user_prompt":"teach me about CSS grid"}' | bash hooks/user-prompt-submit
# Expected: cortex-coach skill hint

echo '{"user_prompt":"explain why this works"}' | bash hooks/user-prompt-submit
# Expected: teaching-moment hint

echo '{"user_prompt":"fix the header layout"}' | bash hooks/user-prompt-submit
# Expected: {} (no match)
```

- [ ] **Step 3: Verify boot-context.py loads profile**

```bash
python3 hooks/lib/boot-context.py --config ~/.claude/cortex/config.json --cwd /tmp 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print('learner_profile' in d)"
```

Expected: `True`

- [ ] **Step 4: Verify trigger-phrases.md has row 22**

```bash
grep "cortex-coach" references/trigger-phrases.md
```

Expected: row 22 entry.

- [ ] **Step 5: Commit verification results (if any fixes were needed)**

```bash
git status
# If clean: no commit needed
# If changes: git add -A && git commit -m "fix: post-verification corrections for cortex-coach"
```

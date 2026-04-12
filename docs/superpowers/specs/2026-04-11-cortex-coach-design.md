# cortex-coach — Adaptive Skill Development

**Date:** 2026-04-11
**Status:** Design approved, pending implementation
**Type:** Core plugin addition (new skill + hook enhancements)

---

## Overview

A coaching layer inside Cortex that reads work patterns, vault state, and learning history — combined with Claude's own expertise — to surface targeted guidance and growth opportunities. Learning flows bidirectionally: Cortex identifies gaps and surfaces recommendations, and the user supplies research and learning material that Cortex incorporates into its understanding.

### Core Principle: Mutual Calibration

cortex-coach doesn't just help the user learn — it helps Claude learn how to help the user. As it tracks what the user struggles with, what they master, and how they prefer to be taught, that understanding feeds back into every Cortex interaction. The coaching loop is a mutual calibration system where both sides get smarter over time.

---

## Skill Identity

**Name:** `cortex-coach`
**Location:** Core plugin (`skills/cortex-coach/SKILL.md`)

**Two modes:**

- **On-demand** — invoked mid-conversation for guidance on current work
- **Scheduled** — runs on a recurring interval (default: weekly), writes a dated growth report to the vault

**Trigger phrases (on-demand):**

- "teach me", "teach me about this", "teach me how to", "teach me why"
- "what should I be learning", "where can I improve"
- "coach me on this", "how could I do this better"
- "what am I missing", "review my approach"
- "skill check", "growth check"

**Scheduled mode:** A scheduled task (via `mcp__scheduled-tasks` or `cortex-weekly` integration) invokes cortex-coach with a report flag. User configures frequency.

---

## Data Sources & Analysis

cortex-coach draws from three layers:

### Layer 1 — Work Artifacts (vault reads)

- `_changelog.txt` — what the user has been doing across projects (frequency, domains, types of work)
- Project hubs — active blockers, stages, decisions (what's challenging them right now)
- `Knowledge Base/` — what they've already captured (known strengths, covered ground)
- `Knowledge Base/Growth/_signals.log` — teaching moments logged by the Stop hook
- `Knowledge Base/Growth/_goals.md` — self-stated learning goals

### Layer 2 — Conversation Patterns (hook-fed)

- The Stop hook logs lightweight entries when Claude provides significant teaching or guidance during a session
- Over time, this reveals recurring themes: "asked about Liquid filters 4 times this month", "needed help with Git rebase in 3 sessions"
- The UserPromptSubmit hook tags teaching-moment exchanges in-flight so the Stop hook knows what to log

### Layer 3 — Claude's Expertise

- Claude brings its training knowledge to bear on the patterns it sees
- Not just "you struggle with X" but "here's the specific concept that would unlock X for you"
- This is what makes it coaching rather than reporting. The vault tells cortex-coach *what* to focus on; Claude knows *how* to teach it

### Analysis Flow

Read all three layers → identify the 2-3 highest-impact growth areas → cross-reference against Knowledge Base (don't recommend what's already internalized) → produce guidance tailored to learning preferences.

---

## Vault Structure

All coaching output lives under `Knowledge Base/Growth/`:

```
Knowledge Base/
├── _MOC.md                          # existing KB index
├── (existing KB articles...)
└── Growth/
    ├── _MOC.md                      # index of growth content
    ├── _goals.md                    # user's self-stated learning goals
    ├── _signals.log                 # teaching moments logged by hooks + on-demand
    ├── _profile.md                  # evolving learner profile
    └── Reports/
        ├── 2026-04-11 Growth Report.md
        ├── 2026-04-18 Growth Report.md
        └── ...
```

### `_goals.md`

User-owned, user-editable. cortex-coach reads on every run but never overwrites user edits.

```markdown
## Active Goals
- [ ] Deepen Liquid templating — want to stop relying on Claude for conditionals and loops
- [ ] Learn Shopify metafield patterns — keep hitting walls on structured data

## Completed
- [x] Git rebase workflow — comfortable with interactive rebase now (2026-04-01)
```

### `_signals.log`

Append-only log written by hooks and on-demand mode. Lightweight structured entries for pattern analysis.

```
[2026-04-11 14:30] TEACHING | domain:liquid | topic:conditional filters | depth:significant | mode:on-demand
[2026-04-11 15:45] TEACHING | domain:css | topic:grid-template-areas | depth:minor | mode:session
[2026-04-11 16:00] GUIDANCE | domain:git | topic:interactive-rebase | depth:significant | mode:session
[2026-04-12 09:15] STRUGGLE | domain:shopify | topic:metafield-definitions | depth:significant | mode:session
```

**Signal types:**

- `TEACHING` — Claude explained something the user didn't know
- `GUIDANCE` — Claude suggested a better approach to something the user was already doing
- `STRUGGLE` — user hit the same kind of problem repeatedly in one session

**Fields:** timestamp, signal type, domain, topic, depth (`significant` or `minor`), mode (`on-demand` or `session`)

### `_profile.md`

The evolving picture of the user as a learner. cortex-coach updates this over time. Other Cortex skills can read it to calibrate their interactions.

```markdown
## Learning Preferences
- Primary: hands-on walkthroughs in conversation
- For conceptual topics: articles and docs
- Prefers concrete examples over abstract theory

## Strengths
- WordPress theme development (deep)
- Shopify storefront basics
- CSS layout (solid, not expert)

## Growth Edges
- Liquid templating beyond basics
- Shopify metafield architecture
- Git workflow (improving — was a frequent signal, declining)

## Calibration Notes
- Prefers terse explanations; go deep only when asked
- Learns fastest from seeing a working example then modifying it
- Gets frustrated by overly cautious "here are 5 approaches" — lead with a recommendation
```

The **Calibration Notes** section is the mutual calibration loop made persistent. Every Cortex skill can read this to adjust how Claude interacts with the user — not just during coaching, but in every session.

---

## Hook Design

### 1. Stop Hook Enhancement — Learning Signal Logger

At session end, scans the conversation for teaching moments and writes entries to `_signals.log`.

**Detection approach:** The hook reads `<cortex-hint type="teaching-moment">` tags injected by the UserPromptSubmit hook to identify which exchanges involved teaching. For untagged exchanges, it checks whether Claude's response included explanations of concepts, step-by-step guidance, or corrections to the user's approach — patterns distinguishable from routine task execution by response structure (instructional framing vs. "here's the code"). The analysis is conservative: when in doubt, don't log.

**What it logs:**

- Exchanges where Claude explained a concept the user didn't know (`TEACHING`)
- Exchanges where Claude suggested a better approach (`GUIDANCE`)
- Cases where the user hit the same kind of problem repeatedly (`STRUGGLE`)

**What it doesn't log:**

- Routine "do this for me" task execution
- Quick factual answers
- Code generation without teaching context

### 2. UserPromptSubmit Enhancement — Teaching Moment Tagger

Detects when the user is asking Claude to teach, explain, or guide. Injects a `<cortex-hint type="teaching-moment">` tag so the Stop hook knows which exchanges to focus on.

**Detection keywords:** "teach", "explain", "why does", "how does", "walk me through", "help me understand", "what's the difference between", "show me how"

### 3. PostToolUse Enhancement — Learning Intake Tagger

When content gets written to `Knowledge Base/`, appends a metadata flag:

- `source:research` — user-initiated research filed to KB
- `source:capture` — ambient pattern captured by cortex-knowledge
- `source:coaching` — content generated by cortex-coach

Lets cortex-coach distinguish "domains the user is actively studying" from "things that came up incidentally."

---

## On-Demand Mode

Invoked mid-conversation when the user asks for guidance.

### Flow

**Step 1 — Read context**

- What is the user currently working on? (session context, conversation topic)
- What do they already know about this domain? (Knowledge Base articles, `_profile.md` strengths)
- Have they struggled with this before? (`_signals.log` entries for this domain)

**Step 2 — Assess the gap**

- What does Claude know about this topic that the user hasn't internalized?
- Is this a knowledge gap (never encountered) or a skill gap (encountered but not mastered)?
- What's the highest-leverage thing to teach right now given what they're trying to accomplish?

**Step 3 — Deliver guidance tailored to learning preferences**

- Check `_profile.md` for how the user prefers to learn
- Walkthroughs → teach inline, offer to go deeper
- Articles/docs → point to specific resources, summarize the key insight
- Code examples → build a concrete example around their current work
- Always connect guidance back to the user's actual project — not abstract theory

**Step 4 — Always persist learning signal**

Every on-demand coaching interaction automatically logs to `_signals.log`:

```
[2026-04-11 14:30] TEACHING | domain:liquid | topic:conditional filters | depth:significant | mode:on-demand
```

This is silent and automatic. The user never has to ask.

**Step 5 — Route reusable knowledge**

If the guidance produced something reusable, cortex-coach proactively applies the reusability test and routes through `cortex-knowledge` for filing. One-line confirmation, not a question.

---

## Scheduled Mode

Runs on a user-configured interval (default: weekly). Produces a dated growth report.

### Analysis Pass

1. **Read `_signals.log`** — aggregate teaching moments since last report. Group by domain, count frequency, identify clusters
2. **Read `_goals.md`** — are signals aligned with goals, or is there drift?
3. **Read recent changelogs** — what domains has the user been working in? Any unfamiliar territory?
4. **Read `_profile.md`** — known strengths, growth edges, learning preferences
5. **Cross-reference Knowledge Base** — don't recommend learning in areas with thorough existing KB articles

### Report Structure

```markdown
---
created: YYYY-MM-DD
type: growth-report
period: YYYY-MM-DD to YYYY-MM-DD
tags:
  - "#type/growth-report"
  - "#source/cortex-coach"
---

## Patterns Observed
- What domains the user worked in, what came up repeatedly
- Where Claude provided the most guidance

## Progress on Goals
- Status against self-stated goals in _goals.md
- Evidence from signals and artifacts

## Growth Edges
- 2-3 specific areas where targeted learning would have highest impact
- Why each one matters for current work
- Recommended next steps, tailored to learning preferences

## Profile Updates
- Any changes to _profile.md based on this period's observations
```

After writing the report, cortex-coach updates `_profile.md` with new observations — shifting growth edges, emerging strengths, refined calibration notes.

The report is a reflection, not a to-do list. The user reads it on their own time and decides what to act on.

---

## First Run Experience

The first time cortex-coach is invoked, it runs a brief intake before producing guidance:

1. **Ask about learning goals** — "What are 2-3 things you'd like to get better at in your work?" → writes to `_goals.md`
2. **Ask about learning preferences** — "How do you prefer to learn? Articles, videos, hands-on walkthroughs, code examples, or depends on the topic?" → writes to `_profile.md`
3. **Bootstrap from vault state** — scan existing Knowledge Base articles, changelogs, and project hubs to infer initial strengths and active domains → writes initial `_profile.md`

After intake, immediately delivers first piece of guidance — so the user gets value on the first invocation, not just setup.

Scaffolds the full `Knowledge Base/Growth/` folder structure including `_MOC.md`, `_goals.md`, `_signals.log`, `_profile.md`, and `Reports/`.

---

## Relationship to Existing Skills

**`cortex-knowledge`** — Complementary. cortex-knowledge captures *what you know* as reusable artifacts. cortex-coach identifies *what you don't know yet* and guides you there. On-demand coaching routes reusable guidance through cortex-knowledge for filing.

**`cortex-weekly`** — Growth reports can run alongside weekly reviews. Weekly review covers project status; growth report covers learning patterns. They can cross-reference each other ("this week's blockers on FKT align with a growth edge in Liquid templating").

**`cortex-boot`** — Boot loads `_profile.md` into session context so calibration notes are available from the first message. This is how mutual calibration feeds into everyday interactions, not just coaching sessions.

**`cortex-update-context`** — When coaching reveals a project-specific insight (not reusable), it routes through update-context to the right project hub.

---

## What cortex-coach Does NOT Do

- Does not replace `cortex-knowledge`. Knowledge capture remains a separate skill with its own triggers and reusability test.
- Does not assign homework or create mandatory tasks. Growth reports are reflections, not assignments.
- Does not modify `personality.md`. The learner profile lives in `_profile.md` as its own file.
- Does not proactively interrupt the user's workflow. On-demand mode is always user-initiated. Scheduled mode writes to the vault silently.
- Does not hardcode learning resources. Claude uses its expertise to recommend; the user decides what to pursue.

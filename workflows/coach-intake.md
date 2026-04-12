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

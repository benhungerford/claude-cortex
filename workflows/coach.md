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

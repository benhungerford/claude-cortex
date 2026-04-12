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

**Step 3: Analyze and draft**

Cross-reference signals, changelog activity, KB articles, and goals to identify:

a. **Patterns observed** — What domains did the user work in most? Where did Claude provide the most guidance? Any surprising patterns?
b. **Progress on goals** — For each active goal, what evidence exists of progress? Signal frequency declining (mastery) or increasing (active learning)? New KB articles in the goal's domain?
c. **Growth edges** — 2-3 specific areas where targeted learning would have the highest impact right now. Why each one matters for the user's current work. Recommended next steps tailored to learning preferences from `_profile.md`.
d. **Profile updates** — Any observations that should update `_profile.md`? A growth edge that's now a strength? A new growth edge emerging? Calibration notes to refine?

**Step 4: Write the report**

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

**Step 5: Update profile**

Read the current `_profile.md` and apply any updates identified in Step 3d:
- Move mastered growth edges to Strengths (with date)
- Add newly identified growth edges
- Refine calibration notes based on observed patterns
- Update the `updated` field in frontmatter

**Step 6: Update Growth MOC**

Add the new report to `Knowledge Base/Growth/_MOC.md` under the Reports section:

```markdown
- [[{{YYYY-MM-DD}} Growth Report]] — {{one-line summary of key finding}}
```

**Step 7: Log and confirm**

- Changelog entries are auto-logged by post-tool-use hook.
- If running as a scheduled task (non-interactive): write the report silently. The user will find it in their vault.
- If running interactively: confirm with one line: "Growth report written for {{period}}. Key finding: {{one-line summary}}."

</process>

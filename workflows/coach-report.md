# Growth report

Procedure for `cortex-coach` in report mode (a scheduled task, or the user asks for a report). If `Knowledge Base/Growth/_profile.md` doesn't exist, run `workflows/coach-intake.md` first.

1. **Set the period.** It starts the day after the last report in `Knowledge Base/Growth/Reports/` ended; with no earlier report, use the last 7 days.
2. **Group the signals** in `_signals.log` for the period by domain. Three or more in a domain is a pattern. Note the mix of `TEACHING` (new concepts), `GUIDANCE` (better approach), and `STRUGGLE` (repeated difficulty).
3. **Read the vault for the same period:** `_changelog.txt` (which domains, any new territory), Knowledge Base articles created or updated, `_goals.md`, `_profile.md`.
4. **Draft:** patterns observed; progress on each active goal, with evidence (signals falling off suggests mastery); 2-3 growth edges with why they matter now and next steps in the user's preferred format; changes to make in `_profile.md`.
5. **Write** `Knowledge Base/Growth/Reports/YYYY-MM-DD Growth Report.md`:

   ```yaml
   ---
   created: YYYY-MM-DDTHH:mm
   updated: YYYY-MM-DDTHH:mm
   type: growth-report
   period: <start> to <end>
   tags:
     - "#type/growth-report"
     - "#source/cortex-coach"
   ---
   ```

   Sections: Patterns Observed, Progress on Goals, Growth Edges, Profile Updates, then the footer `*Related:* [[_MOC]]`.
6. **Update `_profile.md`:** move mastered edges to Strengths with the date, add new edges, refine calibration notes, bump `updated:`.
7. **Add the report** to `Knowledge Base/Growth/_MOC.md` under Reports: `- [[YYYY-MM-DD Growth Report]] — <key finding>`.
8. **Check:** run `validate_frontmatter` on the report and `_profile.md`, and confirm the MOC entry matches the report's filename. Fix anything that fails.
9. **Finish.** On a schedule, stop without a chat message; the report is the output. Interactively, confirm in one line with the key finding.

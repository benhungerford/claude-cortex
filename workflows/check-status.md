# Check status

Procedure for `cortex-check-status`. Read `personality.md` at the vault root first for `bucket_term` and the project list.

1. **Find the project.** Use the session context block's active project if the question doesn't name one, then the cwd's `CLAUDE.md`, then a fuzzy match against `list_projects`. Ask once if it's ambiguous.
2. **Read the hub**, `<bucket_term>/<Project>/<Project> — Project Context.md` (or `read_hub`): status, Stage Tracker, Open Questions & Blockers, Quick Links.
3. **Read `Changelog.md`** for the last few entries.
4. **Answer:** status and stage, open blockers, the last 2-3 decisions. Then flag what needs attention (critical-path blockers, long-open questions, dependencies for the next phase, anything that contradicts what the user is doing now).
5. **Offer more** if it would help: a specific sub-note or the full decision history. Read sub-notes only when the user says yes.

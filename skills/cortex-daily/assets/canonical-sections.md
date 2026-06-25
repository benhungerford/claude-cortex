# Canonical Section Menu

Default starting point shown during the interview. Auto-filter to live connectors
before showing: drop any section whose required connector type is not connected.
User then keeps/drops/reorders/adds. Injection order in PART 5 = the user's chosen order.

| # | Section | Required connector type | Surfaces |
|---|---|---|---|
| 1 | Action Items | — | Carry-forward + all pulled signals, priority-ordered (red/amber/green checkboxes) |
| 2 | Health Flags | — | Project-hub discrepancy groups (stale blockers, slips) |
| 3 | Follow-up | — | Async questions Claude needs the user to answer |
| 4 | Pipeline Summary | — | Source table: what was pulled this run, per connector |
| 5 | Email Triage | email | Reply-needed and important unread, mapped to projects |
| 6 | Task / PM Activity | project-management | Overdue, upcoming, @mentions, reply-needed |
| 7 | Meetings | transcript/recording | New transcripts pulled and filed |
| 8 | Calendar | calendar | Today's agenda, prep flags |
| 9 | Active Project Status | — | Per-project status blocks from hubs |
| 10 | Inbox Residue | — | What landed in _Inbox/ unsorted this run |
| 11 | Changelog | — | What this run created/moved/updated |

## Silent / opt-in (never proposed)

- **YouTube Digest** — surfaced ONLY if the user explicitly asks to pull from YouTube.
  This is opt-in by explicit request; never include it by default.
  Recipe: read Research/ YouTube notes created since last run → dedup by topic →
  top-N takeaways. See `section-library.md`.

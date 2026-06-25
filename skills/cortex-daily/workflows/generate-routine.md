# Workflow — Generate Daily Routine

The cortex-daily generator runs these steps interactively. Output: a fenced prompt
in chat + a saved copy at `.claude/cortex/daily-routine.md`.

## Step 1 — Resolve the vault
Use `find_project_by_cwd`; fall back to `~/.claude/cortex/config.json` → `vault_path`.
Never hardcode a path.

## Step 2 — Auto-detect inputs (no questions yet)
- `list_projects` → project names, bucket/client terms.
- Read `personality.md` → vocabulary, folder layout, sub_note_types, tone.
  If `personality.md` is MISSING: stop and route to `cortex-onboarding`.
- Probe the session for connected MCP tools. Classify each live connector by TYPE:
  - **email** — Gmail, Outlook, Proton, Fastmail, generic IMAP servers
  - **project-management** — Monday, Asana, Trello, ClickUp, Jira, Linear, Basecamp
  - **transcript/recording** — Granola, Fathom, Otter, Fireflies
  - **calendar** — Google Calendar, Outlook Calendar
  Use a name-heuristic + a known-server map; if a server is unrecognized, ask the
  user which type it is (this is the only auto-detect question allowed).
- If `.claude/cortex/daily-routine.md` exists → enter REFRESH/DIFF mode (Step 6b).

## Step 3 — Present inferred profile and confirm
Show: vault path, project count, detected connectors (by type + vendor), and the
canonical section menu auto-filtered to live connector types. Ask the user to
confirm/edit the connector list and choose a run-time (e.g. 7:00am).

## Step 4 — Custom-section interview
Show the auto-filtered canonical menu from `assets/canonical-sections.md`. The user:
1. keeps/drops sections,
2. reorders them (this is the PART 5 injection order),
3. adds custom sections (name + reads + surfaces) → map to the generic recipe.
Surface the YouTube section ONLY if the user explicitly asks for it.
For any chosen/custom section needing an absent connector type, warn and offer to
drop it or keep it as a manual placeholder.

## Step 5 — Assemble the output prompt
- Load `assets/routine-skeleton.md`.
- Fill slots: `<user>`, `<vault_path>`, `<connector_pull_list>` (one line per live
  connector), and `<YYYY-MM-DD>` left literal for the routine to fill at run-time.
- For each chosen section, pull its recipe from `assets/section-library.md`, compose
  a concrete body (real connector names, board→project map from memory.md, real
  folder paths), and inject all bodies — in the user's order — at the
  `<!-- INJECT: SECTION BODIES -->` marker.
- Do NOT edit any locked rail.

## Step 6 — Emit and save
- Print the full assembled prompt to chat inside a fenced block for clean copy.
- Write `.claude/cortex/daily-routine.md` with a **metadata header** then the prompt:

  ```
  ---
  generated: <YYYY-MM-DD>
  connectors: [<type:vendor>, ...]
  sections: [<section in chosen order>, ...]
  run_time: "<HH:MM>"
  ---
  <fenced prompt>
  ```
- `append_changelog` a CREATED (first run) or UPDATED (refresh) entry.

### Step 6b — Refresh / diff mode
When a saved `.claude/cortex/daily-routine.md` exists:
- Read its metadata header to recover the prior connectors + section choices.
- Re-detect current projects + connectors; compute the delta (e.g. "+2 projects,
  +Asana, −Fathom").
- Show the diff. PRESERVE the prior section choices; only apply the deltas
  (add sections for new connector types, drop sections whose connector vanished,
  refresh project lists in composed bodies).
- On confirm, rewrite the file and `append_changelog` UPDATED.

## Step 7 — Instruct the user
Tell the user: open Claude → create a new Routine → paste the prompt → schedule it
for the chosen run-time. Note that re-running `/cortex-daily` later refreshes it.

## Edge cases

| Case | Handling |
|---|---|
| No connectors live | Generate a briefing-only routine (vault-internal sections only). Note connector sections unlock when tools connect. |
| `personality.md` missing | Stop; route to `cortex-onboarding`. |
| Custom section needs an absent connector | Warn "no connector; will no-op"; offer drop or keep-as-manual. |
| Routine env lacks cortex-vault MCP | The skeleton already embeds literal fallbacks (manual file ops + changelog line format). |
| Two connectors of the same type | One section body covers both. |
| First run, no saved file | Full interview (no diff). |
| Unattended run hits true ambiguity | Routes to _Inbox/ + Inbox Residue (enforced by the skeleton). |

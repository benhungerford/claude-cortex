---
avatar: "12"
persona: "Real-estate agent — 20 active property deals, each a mini-project with daily status churn"
date: "2026-06-01"
surface: "Claude Desktop"
auditor: "Stress-test sub-agent"
---

# Avatar 12 — Daily-Use Audit

## Persona

Real-estate agent managing 20 concurrent property deals: buyer searches, seller listings, contingency negotiations, escrow timelines, inspection resolutions, and loan-approval blockers — all in flight simultaneously. Each deal is a mini-project with its own buyer/seller contact, milestones (under contract, inspection, appraisal, clear-to-close), and a revolving cast of blockers that appear and clear multiple times per day. They use Claude Desktop (not CLI), so there is never an L3 session from cwd — activation is L1 at boot every morning, with manual escalation via project-name mentions or vault-cwd access. They rely on Cortex primarily for status checks ("where are we on the Maple Street offer?"), rapid blocker logging ("new blocker: appraisal came in $15k short on Oak Ave"), and post-meeting filing after buyer calls and offer review sessions.

This persona is adversarial for Cortex because: (1) 20 projects push the activation system into constant L1-to-L2 ambiguity since no cwd ever matches a repo; (2) real-estate vocabulary is highly domain-specific ("contingency", "escrow", "clear to close", "appraisal gap") and does not appear in the trigger-phrase registry at all; (3) status queries arrive in rapid-fire bursts ("what's the status of Maple, Oak, and Pine?") that the system is not designed to batch; and (4) decisions and blockers are often oral ("buyer just said they'll waive the appraisal gap — log it") which puts maximum pressure on ambient capture.

---

## Simulated Day-in-the-Life

**08:00 — Opens Claude Desktop from the desktop (no project cwd)**

`session-start` fires. `boot-context.py` receives `PWD=/` or a desktop cwd — neither matches any registered repo, neither is inside the vault. The activation level resolves to L1 — Passive (`hooks/lib/boot-context.py:122–154`). The `<cortex-session>` block carries `Level: L1 — Passive` and `Active projects:` lists all 20 deal buckets by name from `personality.md`'s `buckets` YAML array. `cortex-boot` runs silently. The agent opens with "Good morning — what are we working on?" or similar. Clean start.

**08:05 — Status burst: "quick rundown — Maple Street, Oak Ave, Pine Ridge, what's the status?"**

The `user-prompt-submit` hook fires. `LOWER` is scanned against the pattern `*"what's the status"*` (hook line 149). "what's the status?" matches. A single `<cortex-hint>` for `cortex-check-status` is injected. However, the user named THREE projects in one sentence. `cortex-check-status`'s procedure (SKILL.md, procedure step 1) says: identify a single project. The skill's worked examples only show one-project queries. There is no batching path documented in `cortex-check-status/SKILL.md` or `workflows/check-status.md`. The model will likely handle the three-project case via sequential reads (read hub once, answer, repeat) but the skill spec does not define this, meaning the behavior is model-improvisation rather than specified behavior. The user gets three separate paragraphs of varying quality.

**08:15 — Blocker lands: "new blocker on Oak Ave — appraisal came in $15k short"**

`user-prompt-submit` fires. `LOWER` contains `new blocker` — matched by hook pattern at line 99 (`*"new blocker"*`). A `cortex-hint` for `cortex-update-context` is injected with `confidence: high`. Good — the hook correctly routes this.

`cortex-update-context` runs: identify project (Oak Ave — matches a bucket), change type = new blocker, route to Hub Open Questions. The skill's routing table (`cortex-update-context/SKILL.md`, routing table row 2) says: new blocker → Hub Open Questions table + Changelog.md + _changelog.txt. The MCP tool `open_question` is called with `action: add`, `text: "Appraisal came in $15k short"`. 

Critically: `open_question.js` writes a `- [ ] text` checkbox to the `## Open Questions` section (line 32–59). But `boot-context.py`'s `parse_hub` function reads blockers from a `## Open Questions & Blockers` table (lines 207–224) using a DIFFERENT section name and a pipe-delimited table format (not checkboxes). The `open_question` MCP tool writes checkboxes to `## Open Questions`; `parse_hub` reads from `## Open Questions & Blockers` as a Markdown table. If the agent's vault was scaffolded via `scaffold_project`, the context file has `## Open Questions` (checkbox format, `scaffold-project.js:180`). If it was created from the original template, the hub may have a table-format section. These two paths produce hubs that parse differently at boot, meaning new blockers added via the MCP tool may not appear in the L3 boot summary. This is a data-model split between writer (`open_question.js`) and reader (`boot-context.py`), not just stylistic.

**08:45 — Blocker resolved: "appraisal gap on Oak Ave was waived by buyer — we're good"**

`user-prompt-submit` fires. `LOWER` is "appraisal gap on oak ave was waived by buyer — we're good". The hook checks patterns in order. At line 105: `*"that's resolved"*|*"blocker resolved"*|*"unblocked"*`. None of these match "was waived by buyer." The hook emits `{}` — no hint. `cortex-update-context` is NOT routed to. The model must catch this via ambient L3/L2 capture watch, but this session is L1 (no cwd match, user mentioned the project name → escalated to L2 during this session). L2 ambient watch applies Tier 1 rules, but the resolution phrase "was waived" is domain-specific; the model may or may not classify it as a blocker-resolved signal. The `trigger-phrases.md` spec says "we got <X> (where X is a previously-logged blocker)" should work (row 9), but this phrase isn't in the hook and the parenthetical condition "(where X is a previously-logged blocker)" requires model-side memory context not available to the hook. In real estate, resolutions sound like "buyer waived", "contingency removed", "lender approved", "inspection signed off" — none of these are in the hook's trigger vocabulary.

**09:30 — Multi-deal update from a team morning meeting**

The agent pastes 28 lines of notes covering five deals from a morning huddle. The `user-prompt-submit` hook fires. The structural transcript detector (hook lines 60–68) checks: `LINE_COUNT >= 20` (yes, 28) AND `SPEAKER_COUNT >= 3` (the notes say "Me: ...", "Colleague: ...", "Manager: ..." — three speaker labels). SPEAKER_COUNT fires `cortex-process-meeting` with `confidence: high`. But this is NOT a meeting transcript — it is a morning status update covering five deals. The agent wanted Cortex to extract five deal updates and log each to the relevant project hub. Instead, `cortex-process-meeting` fires and tries to file a single meeting note under one project, then extracts decisions. The meeting routing question ("Which project does this meeting belong to?") is asked once — but the notes span five projects with no single primary. The agent answers "this covers all five" and the skill, which expects a single destination folder, will either ask again or pick incorrectly, wasting the agent's time.

**10:15 — "where are we on the Pine Ridge inspection contingency deadline?"**

`user-prompt-submit` fires. `LOWER` = "where are we on the pine ridge inspection contingency deadline?" Pattern at line 149 matches `*"where are we on"*`. Hint injected for `cortex-check-status`. The skill reads the Pine Ridge hub. The hub has no field for "inspection contingency deadline" — this is real-estate workflow data that Cortex's scaffold doesn't model. The hub has `## Stage Tracker`, `## Open Questions`, `## Blockers`. There is no `## Timeline` or `## Key Dates` section in the `scaffold_project.js` template (lines 178–184). The agent's critical deadline data (inspection period end, appraisal deadline, loan contingency removal date, close of escrow) does not have a designated home in the vault structure. Status checks return stage and blockers but not the time-sensitive deadline data that is the core of real-estate daily management.

**11:00 — "log this to Pine Ridge: close of escrow moved to June 15"**

`user-prompt-submit` fires. "log this to pine ridge" matches `*"log this"*` at hook line 87. Hint for `cortex-update-context`. The skill routes: scope/status change → Hub + Changelog. It reads the hub, finds `## Stage Tracker`, and tries to log the date change. But the stage tracker table only has "stage name | status" columns (`boot-context.py:185–201`). A COE date is not a stage — it is project metadata. The skill would likely put it in a Changelog.md entry and possibly in Overview, but the date is not structured as queryable data. Next time the agent asks "when does Pine Ridge close?", semantic search (`recall_related`) might surface the Changelog entry, but the date is buried in freeform text. There is no `launch:` or `close_date:` frontmatter field that `read_hub` would surface (it reads `status`, `launch`, `project`, `client` from frontmatter — `read-hub.js:107–118`). The `launch:` field exists in `read_hub` output but is only populated if someone manually sets it; scaffold doesn't set it.

**14:30 — After-call: pastes 35-line buyer call notes, single-project, clear speaker labels**

`user-prompt-submit` fires. LINE_COUNT=35, SPEAKER_COUNT=3. Hard-routes to `cortex-process-meeting`. This works well. The skill creates a meeting note, threads it with prior call notes (if the series has ≥ 3 entries via `thread_meeting.js`), extracts decisions (buyer preference for 30-day close, waiver of repair request), and logs to the hub. The threading requires the series title to match exactly — `thread_meeting.js` groups by the `title` portion after the date prefix (line 178: `groups[m.title]`). If the agent titles calls inconsistently ("Buyer Call" vs "Smith Buyer Call" vs "2026-05-15 Smith Buyer Check-in"), `thread_meeting` silently skips threading with no warning to the agent that the series was not linked. The only signal is "Series has X note(s) — need at least 3 to thread. Skipping." — which is returned in the MCP tool's response text, potentially not visible to the agent unless the skill surfaces it.

**16:00 — End of day: "how many of my deals have open blockers right now?"**

This is a cross-project aggregate query. No trigger phrase matches. `user-prompt-submit` emits `{}`. The model has L2 vault-aware context but the boot block only pre-loaded `active_projects` as a flat string list (`Active projects: Maple Street (listing), Oak Ave (buyer), ...`) — no blocker counts per project (boot-context.py lines 80–81: only the active_projects bucket list, not per-project hub data, is included at L2). To answer the aggregate question, the model would need to call `read_hub` 20 times or call `search_vault` with a query about blockers. Neither is fast. At 20 projects, this is a wall-clock latency problem: 20 sequential MCP calls at ~200ms each = ~4 seconds of spinning before an answer appears. There is no batch-read-hubs tool in the MCP server (`server.js` tool list: append-changelog, update-moc, read-hub, find-project-by-cwd, validate-frontmatter, scaffold-project, thread-meeting, check-dormant-features, list-projects, open-question, search-vault, recall-related, reindex-vault, register-repo). A bulk status query across many projects has no efficient path.

---

## Findings

### Finding 1 — Status queries cannot be batched; 20-project aggregate is unusably slow

**Area:** status  
**Severity:** P0  
**Evidence:** `mcp-servers/cortex-vault/server.js:18–31` (tool list — no batch read_hub); `hooks/lib/boot-context.py:433` (only one project's hub is pre-loaded at L3; L1/L2 get only bucket names); `skills/cortex-check-status/SKILL.md:47` ("Only read the hub and changelog by default" — single project).  
**Impact:** The real-estate agent's most frequent daily action is "give me status across deals X, Y, Z." The system has no answer path for this. At L1/L2 boot, only a flat string of project names is pre-loaded — no hub data. Answering "which of my 20 deals have open blockers?" requires 20 sequential MCP `read_hub` calls. At 200ms/call, that is ~4 seconds minimum, plus model reasoning time, before the first answer token appears. For a persona with daily status churn across 20 projects, this renders the primary daily use case frustratingly slow.  
**Suggested fix:** Add a `list_projects_with_status` MCP tool (or extend `list-projects.js`) that reads every hub in a single pass and returns a compact summary per project: `{name, stage, blocker_count, last_updated}`. Cap at the most recently-updated N projects. This makes the daily "open blockers across all deals" query sub-second.

---

### Finding 2 — open_question.js uses checkbox format; parse_hub reads table format — new blockers written via MCP tool don't appear in L3 boot summary

**Area:** capture  
**Severity:** P0  
**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js:32–59` — writes `- [ ] text` checkboxes to `## Open Questions`. `hooks/lib/boot-context.py:206–224` — `parse_hub` reads from `## Open Questions & Blockers` as a pipe-delimited Markdown table, filtering by `typ in ("Dependency", "Internal", "Unknown")` with a `cells[4]` status column. `mcp-servers/cortex-vault/tools/scaffold-project.js:179` — scaffold creates `## Open Questions` (checkbox, no table). These three components disagree on section name and format.  
**Impact:** When the agent says "new blocker on Oak Ave — appraisal came in $15k short," `cortex-update-context` calls `open_question` with `action: add`. The checkbox is written to `## Open Questions`. At the next session, `parse_hub` scans for `## Open Questions & Blockers` (different name) in table format — not found. The blocker is invisible in the L3 boot summary. The agent opens the next morning session and Cortex does not surface the Oak Ave appraisal gap. A critical deal blocker is silently lost from boot context.  
**Suggested fix:** Unify the format. Either (a) change `parse_hub` to also scan `## Open Questions` for checkbox items, or (b) update `open_question.js` to write table rows to `## Open Questions & Blockers` matching the parse_hub schema. Option (a) is less invasive. Add a test that round-trips `open_question add` → `parse_hub` and asserts the new item appears in `result.blockers`.

---

### Finding 3 — Domain-specific resolution phrases silently fall through the hook; real-estate resolutions are never recognized

**Area:** capture  
**Severity:** P1  
**Evidence:** `hooks/user-prompt-submit:105` — resolved trigger patterns: `*"that's resolved"*|*"blocker resolved"*|*"unblocked"*`. `references/trigger-phrases.md:29` — also lists `"we got <X>"` but this is NOT in the hook bash code. Real-estate resolution vocabulary: "buyer waived the contingency," "lender approved the loan," "inspection signed off," "appraisal gap covered," "clear to close."  
**Impact:** The agent clears blockers multiple times per day using domain-natural language. None of these phrases match the hook's three hardcoded patterns. The hook fires `{}` every time. Capture of blocker resolutions depends entirely on ambient model-side watch at L2/L3, which is not enforced and is more likely to miss signals than the hook. The daily loop of adding and clearing blockers — the core daily loop for this persona — is not reliably captured.  
**Suggested fix:** Extend the hook's resolved trigger patterns to cover natural-language resolution cues. Adding: `*"waived"*|*"approved"*|*"cleared"*|*"we got "*|*"signed off"*|*"contingency removed"*` would substantially improve coverage. Also add the `"we got <X>"` entry that `trigger-phrases.md:29` documents as a trigger but the hook (line 105) does not implement — that is a doc-code divergence on top of the coverage gap.

---

### Finding 4 — Hub scaffold missing real-estate date fields; "when does X close?" has no structured answer path

**Area:** capture  
**Severity:** P1  
**Evidence:** `mcp-servers/cortex-vault/tools/scaffold-project.js:163–185` — `Project Context.md` template has `## Overview`, `## Current Phase`, `## Open Questions`, `## Key Decisions`, `## Blockers`. No `## Key Dates`, no `timeline:` frontmatter field. `mcp-servers/cortex-vault/tools/read-hub.js:107–118` — reads `status`, `launch`, `open_questions`, `blockers`, `current_phase`, `key_decisions`. The `launch:` field exists in the reader but scaffold never sets it.  
**Impact:** Every real-estate deal has critical time-bound milestones: inspection contingency deadline, appraisal deadline, loan contingency removal date, close of escrow. These dates drive daily urgency. When the agent asks "when does Pine Ridge close?" or "which deals have contingency deadlines this week?", Cortex has no structured field to read. Answers must be inferred from freeform Changelog entries, which are not queryable. The `launch:` field in `read_hub` is a partial solution but scaffold never populates it, so it stays null for all scaffolded projects.  
**Suggested fix:** (a) Add an optional `## Key Dates` section to the scaffold template with date placeholders for "Inspection Deadline", "Appraisal Deadline", "Contingency Removal", "Close of Escrow". (b) Populate the `launch:` frontmatter field with close-of-escrow date when scaffolding a real-estate project. (c) Extend `read_hub.js` to return a `key_dates` field parsed from that section. This also makes "when does X close?" answerable via a structured read, not a semantic guess.

---

### Finding 5 — Multi-project paste (5-deal morning huddle) hard-routes to cortex-process-meeting, which expects a single destination

**Area:** meeting  
**Severity:** P1  
**Evidence:** `hooks/user-prompt-submit:60–68` — transcript detector: `LINE_COUNT >= 20 AND SPEAKER_COUNT >= 3` → routes to `cortex-process-meeting` with `confidence: high`. `skills/cortex-process-meeting/SKILL.md:42–45` — "Step 1: Identify meeting context — which project." `workflows/process-meeting.md:10` — "Which project? — Match to an active bucket." The skill asks "Which project does this meeting belong to?" when context is ambiguous, but the multi-deal update isn't ambiguous — it genuinely covers multiple projects.  
**Impact:** A real-estate agent's morning team huddle covers all active deals. Pasting 28 lines of "Deal A — buyer approved, Deal B — appraisal gap, Deal C — counter offer pending..." triggers the meeting processing hard-route (LINE_COUNT=28 ≥ 20, SPEAKER_COUNT ≥ 3 if attendees are labeled). `cortex-process-meeting` fires expecting to file a single meeting note in one project folder and cross-link to others. For a 5-deal update, it asks the routing question, the agent says "all five," the skill is not designed for that answer. The agent ends up going through multiple rounds of ambiguity resolution and file operations that should be five separate update writes to five separate hubs — not a single meeting note.  
**Suggested fix:** Add a multi-project path to `cortex-process-meeting` procedure, triggered when the transcript explicitly mentions 3+ project names from the known bucket list. The multi-project path should: (1) skip meeting-note filing (or file under a "Team Syncs" folder), (2) route each deal mention as a separate `cortex-update-context` call, and (3) announce each hub update individually. Alternatively, lower the threshold for the structural trigger (require ≥ 5 speaker lines instead of ≥ 3) to avoid routing a status-update paste into meeting processing.

---

### Finding 6 — L2 boot only loads bucket names, not hub data; "active projects" is a flat string useless for follow-up queries

**Area:** boot  
**Severity:** P2  
**Evidence:** `hooks/lib/boot-context.py:433` — `active_projects = extract_buckets(personality) if activation_level < 3 else None`. `extract_buckets` (lines 94–108) returns a comma-joined string like `"Maple Street (listing), Oak Ave (buyer), ..."`. `hooks/session-start:80–81` — this string is emitted as `Active projects: <string>` in the session block. No hub data, no stage, no blocker counts. `hooks/lib/boot-context.py:252–364` — the token budget fills project hub data ONLY for L3 sessions (`priority` list line 317: `("project", ...)` is only set when `activation_level == 3`).  
**Impact:** The agent starts every day at L1 in Claude Desktop. They mention a project name — session escalates to L2. At L2, Cortex knows the project exists by name but has no cached hub data in the session block. Every status query, every blocker check, every "where are we on Maple Street?" requires a live `read_hub` MCP call. For 20 projects with multiple queries per day, this means every morning is dominated by cold reads. There is no "warm" mode where the most recently-updated projects get their hub stubs pre-loaded at L2 boot.  
**Suggested fix:** At L2 boot, pre-load abbreviated hub stubs (name, stage, blocker_count, last_updated date) for the top N projects by recency (sort by `updated` frontmatter field or by `_changelog.txt` last-touch). Cap at 3–5 projects. This costs some token budget but can be bounded (a 5-project stub at ~100 chars/project = ~500 chars, well within the 8000-char budget). The status query "where are we on Maple Street?" then returns from pre-loaded context instead of triggering a file read.

---

## Summary

The real-estate persona exposes three structural mismatches between how Cortex was designed and how this domain operates:

1. **Volume mismatch** — 20 projects with daily status churn require batch query and pre-loaded hub summaries. The system is optimized for 3–5 projects with occasional status checks.

2. **Vocabulary gap** — Real-estate resolution/capture phrases ("buyer waived", "lender approved", "contingency removed") are entirely outside the hook's trigger vocabulary, which was written for software-development idioms.

3. **Data model gap** — The scaffold template has no date fields, the hub reader can return `launch:` but scaffold never sets it, and the open-question writer and boot-context reader use incompatible formats — meaning critical blocker and date data either don't appear at boot or don't have a structured home at all.

The P0 findings (Finding 1 and 2) would directly break the agent's daily loop: aggregate status queries are slow to the point of uselessness, and newly-added blockers are invisible at the next session boot.

# Daily-Use Audit — Avatar 16

**Date:** 2026-06-01
**Persona:** Startup PM — coordinating eng, design, and sales across multiple active projects per session
**Surface:** Claude Desktop
**Auditor model:** claude-sonnet-4-6

---

## Persona

Ben is a Startup PM running three concurrent client/product tracks: an e-commerce Shopify build (FKT), a compliance project (Bubl Shots), and an internal sales pipeline tool. On any given day he touches all three. His Claude Desktop sessions do not cleanly map to one project — he pivots mid-conversation ("quick FKT thing, then I need to talk about Bubl"). He processes Granola meeting transcripts at the end of the day. He logs decisions verbally ("going with Stripe, log that") and expects Cortex to track project health without him managing it.

---

## Day Narrative

**8:47 AM — First session, cwd = ~/Documents/random-scratch/**
Claude Desktop opens. The session-start hook fires `boot-context.py` with the scratch directory as cwd. `resolve_cwd` walks up, finds no registry match, and assigns L1. The cortex-boot skill sees L1 and stays silent. Good. Ben asks "what's the status of FKT?" and types it. The `user-prompt-submit` hook fires, matches the "status of" pattern, injects a `<cortex-hint>likely-skill: cortex-check-status</cortex-hint>`. The model routes to `cortex-check-status`.

**Finding 1 appears here:** `cortex-check-status` must now resolve the project path. The skill says to use `mcp__cortex-vault__read_hub` and pass `project_path`. But the model only has the project *name* from the session block's `Active projects:` line (a flat comma-separated bucket list from `extract_buckets()`). There is no tool to fuzzy-match "FKT" to a vault-relative path without already knowing the path. The skill says "use `list_projects`" but no such tool exists in the MCP server — only `find_project_by_cwd`. So the model must fall back to scanning `personality.md` manually for the vault path.

**9:15 AM — Mid-conversation pivot: "quick Bubl question then back to FKT"**
Ben asks about FKT, then pivots: "by the way, what's blocking Bubl?" Two status queries in one session. At L1 there is only one entry per project in `Active projects:` (the bucket string). Both matches come from the same flat string. The model must run two separate `read_hub` calls to two different paths. The `recall_related` call (triggered by the new Bubl context) now fires with Bubl context — but at L1, the previous FKT context is still live. There is no mechanism to scope `exclude_paths` to the prior project's hub that was just read. Both projects' notes may surface in recall, creating cross-project contamination.

**10:30 AM — Writing a decision: "going with Stripe for Bubl, log that"**
`user-prompt-submit` matches "going with" AND "log that" in the same sentence. Both `cortex-update-context` triggers fire. The disambiguation rule in `trigger-phrases.md` says write-side beats read-side and two write-side triggers collapse to one. But **Finding 2 appears here:** the `user-prompt-submit` hook uses a `case` statement with `first match wins` (line 82–155 in `hooks/user-prompt-submit`). The "going to go with" branch (3c decision triggers) matches first at line 93, so the skill fires as `cortex-update-context` with `CONFIDENCE=high`. But "log that" (line 87) is checked in the same block and also matches. Due to bash `case` falling into the first match, the trigger description logged is `decision trigger` not `log/add trigger`. This is minor — both route to the same skill — but the wrong `TRIGGER_DESC` ends up in the hint, potentially confusing the model when it reads it.

**11:00 AM — Conflict detection: Bubl already has a different payment processor in the hub**
The Conflict Rule in `cortex-update-context` requires comparing new information against the current hub. The `open_question` MCP tool (`tools/open-question.js`) is the MCP path for writing blockers. But **Finding 3 appears here:** `open_question` uses a simple checklist format (`- [ ] text`) when adding questions (line 38 in `tools/open-question.js`). The `resolve` action marks items `- [x] text — Resolved: <resolution>` (line 77) — leaving a checked item in place with strikethrough-equivalent. But `cortex-update-context`'s SKILL.md "Blocker-Resolved Rule" (step 1) explicitly says **remove** the row entirely, not leave a `- [x]` in place. The MCP tool and the skill spec are in direct conflict. The model following the skill will try to manually delete the row; the model using the MCP tool will leave a `[x]` artifact that contradicts the spec. Ben's project hub slowly accumulates resolved-but-lingering `[x]` clutter — hard to scan at a glance.

**1:30 PM — Granola transcript arrives for a meeting that touched FKT and Bubl**
Ben pastes the Granola export (350 lines, multiple speakers). The `user-prompt-submit` hook fires, counts 350 lines (≥20) and counts 6 speaker-label lines (≥3), routes to `cortex-process-meeting` with `CONFIDENCE=high`. Good. But **Finding 4 appears here:** the `thread_meeting` MCP tool (`tools/thread-meeting.js`) requires `effectiveGroup.length >= 3` to thread (line 194). If the FKT standup series only has 2 prior notes, threading is silently skipped with a plain text message: "Series has 2 note(s) — need at least 3 to thread. Skipping." The `cortex-process-meeting` SKILL.md says (step 4, threading procedure) "If 2+ prior entries, thread it." The MCP tool gate requires 3 total (2 prior + 1 new). This means the *second* meeting in a series (1 prior + 1 new = 2 total) never gets threaded by the MCP tool, but the skill spec says it should be. The third meeting is the first to get threaded. Ben loses chronological linking for the first pair of every recurring series.

**3:45 PM — Ben asks about the project he's NOT in: "is on track" phrasing**
Ben types "is FKT on track?" The `user-prompt-submit` hook checks against its pattern list (lines 147–155). The pattern `*"is on track"*` is **not in the pattern list**. The status patterns are: `status of`, `what's the status`, `where are we on`, `what's left on`, `what's blocking`, `any open questions`. "Is X on track" produces no hint. The model receives no skill routing hint and may handle it generically rather than invoking `cortex-check-status`. `cortex-check-status` SKILL.md row 5 in `trigger-phrases.md` includes "is <X> on track" as a literal trigger, but the hook implementation does not match it. The hook and the spec are diverged.

**5:00 PM — Session end: `stop` hook fires**
The stop hook reads `pending-memory.json` and flushes it to `memory.md`. It appends content at the end (line 166 in `hooks/stop`): `f.write('\n' + content + '\n')`. **Finding 5 appears here:** the `section` field from each pending update entry is ignored entirely (line 163: `section = entry.get('section', '')` is extracted but never used). Every memory flush is a bare append, ignoring any intended organizational structure. For Ben as a multi-project PM, this means memory about FKT and Bubl accumulates as an undifferentiated log — no project-namespacing, no section headers. The `read_memory` function in `boot-context.py` tail-caps at 100 lines (line 55). As sessions accumulate, earlier cross-project memory gets silently evicted without any notification or per-project preservation guarantee.

**All-day — Ambient recall across multiple projects**
Throughout the day, `recall_related` fires at most once per user turn with `limit: 5`. For a PM juggling 3 projects, the recall results are scoped by cosine similarity to the current turn's text — not filtered to the currently active project. A question about Bubl's age-verification compliance can surface FKT Shopify notes that happen to mention "compliance" in a different sense. **Finding 6 appears here:** there is no project-scope filter on `recall_related`. The `exclude_paths` parameter (recall-related.js lines 77–82) only excludes specific file paths the caller provides, not an entire project subtree. At L1 or L2 with multiple active projects, semantically adjacent notes from the wrong project will surface with no project label on the result. The model must infer project ownership from the note path, but the `why` field (lines 18–38) extracts terms from note titles and headings — it does not include the project name or path prefix as context. Ben sees "Worth knowing: [[2026-05-20 Compliance Review]]" with no indication that this is the FKT compliance note, not the Bubl one.

---

## Findings

### Finding 1 — `list_projects` MCP tool is referenced in SKILL.md but does not exist

**Area:** status
**Severity:** P1
**Evidence:** `skills/cortex-check-status/SKILL.md` line 37: "Instead of: Manually enumerating all projects to find the right one — Use MCP tool: `mcp__cortex-vault__list_projects`". Cross-referenced against `mcp-servers/cortex-vault/` — no `list-projects.js` tool file exists. The `server.js` tool registry does not include this tool. The fallback is manual `personality.md` parsing which requires a separate file read not included in the `cortex-session` block at L1.
**Impact:** Every status query at L1 from a multi-project PM requires ad-hoc personality.md scanning. The skill's documented fast path (MCP tool) is a dead reference. High frequency — every cross-project status check hits this gap.
**Suggested fix:** Implement `list_projects` as an MCP tool that reads `registry.json` and returns `[{id, name, vault_path, context_file}]`. This unblocks the documented skill path and eliminates manual personality.md parsing for project discovery.

---

### Finding 2 — `open_question` resolve action leaves `[x]` artifacts, contradicting the Blocker-Resolved Rule

**Area:** capture
**Severity:** P1
**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js` line 77: `lines[matchIdx] = \`- [x] ${originalText} — Resolved: ${resolution}\``. This leaves the row in-place with a checked marker. `skills/cortex-update-context/SKILL.md` lines 89–97 (Blocker-Resolved Rule, step 1): "Remove the row from the Hub's Open Questions table entirely. Do not use strikethrough. Do not mark it 'resolved' in-place."
**Impact:** Every resolved blocker written via the MCP tool creates a permanent `[x]` artifact in the hub. The Open Questions table accumulates stale resolved items over weeks. At L3 boot, `parse_hub` in `boot-context.py` filters on `status.lower() == "resolved"` (line 219) for the table format, but the `open_question` tool uses a checklist format, not a pipe-delimited table — so boot-context's parser never sees these items anyway. The table and the checklist are two incompatible formats being used simultaneously.
**Suggested fix:** Change `resolveQuestionInBody` in `open-question.js` to delete the matched line rather than marking it `[x]`. Add the resolution text to the caller's changelog entry instead, matching the spec.

---

### Finding 3 — `thread_meeting` requires 3-note series minimum; skill spec says 2-note threshold

**Area:** meeting
**Severity:** P2
**Evidence:** `mcp-servers/cortex-vault/tools/thread-meeting.js` line 194: `if (effectiveGroup.length < 3) { return ... "need at least 3 to thread" }`. `skills/cortex-process-meeting/SKILL.md` lines 71–72 (threading rules): "A series exists when: 3 or more meetings in the same folder share a stable title suffix... The new meeting's title matches an existing series." This actually agrees — 3 total. But the same SKILL.md threading procedure at line 79 says "find the most recent prior instance of the same series" and the worked example (lines 103–136) shows threading after the series has "4 prior entries". The ambiguity is between the *series detection rule* (3 total) and user expectation (thread from the second meeting onward, i.e. 2 total). Regardless, the silent skip message is never surfaced to the user — the `cortex-process-meeting` skill announces "Meeting filed" without noting that threading was skipped.
**Impact:** For a PM starting new recurring meeting series (weekly syncs, standups), the first two meetings in any series are never linked chronologically. If Ben processes week 1 and week 2 standups, he has no `*Previous:*/*Next:*` chain until week 3. He discovers broken threading only when navigating backward from week 4.
**Suggested fix:** Lower the threshold to 2 (thread as soon as there is 1 prior instance). If keeping 3, ensure `cortex-process-meeting`'s announcement explicitly states "(not threaded — need 1 more meeting to establish series)" so Ben knows.

---

### Finding 4 — `is <X> on track` not matched by `user-prompt-submit` hook; trigger-phrases.md lists it

**Area:** status
**Severity:** P2
**Evidence:** `references/trigger-phrases.md` row 5: includes `"is <X> on track"` as a literal trigger for `cortex-check-status`. `hooks/user-prompt-submit` lines 147–155: status patterns are `status of`, `what's the status`, `where are we on`, `what's left on`, `what's blocking`, `any open questions`. The substring `"is on track"` or `"on track"` does not appear. The hook and the canonical trigger table are diverged.
**Impact:** A natural PM phrase like "is FKT on track?" receives no `<cortex-hint>` injection. The model may still route correctly if the skill descriptions are loaded, but there is no low-latency hook-assisted routing. In practice, this type of question is common for someone doing a rapid multi-project health check — exactly the persona this audit covers.
**Suggested fix:** Add `*"is on track"*|*"on track?"*` to the status patterns block in `hooks/user-prompt-submit` around line 149.

---

### Finding 5 — Memory flush ignores `section` field; multi-project memory becomes undifferentiated log

**Area:** capture
**Severity:** P2
**Evidence:** `hooks/stop` lines 163–168: `section = entry.get('section', '')` is read but immediately unused — only `content` is appended. The 100-line tail cap in `boot-context.py` `read_memory()` (lines 54–57) evicts the oldest lines silently when the file exceeds 100 lines. No per-project namespacing exists.
**Impact:** A multi-project PM accumulates memory entries about FKT, Bubl, and internal tools in one flat list. As the log grows past 100 lines, early cross-project facts are silently evicted. There is no summary or warning when eviction occurs. At boot, the model receives the most recent 100 lines regardless of which project is active — context about the currently-active L3 project may already have been evicted by churn from other projects.
**Suggested fix:** Use the `section` field to insert a `## <section>` header before the appended content, enabling grouped recall. Add a one-line eviction notice to the boot session block when `len(lines) > cap` (e.g., `Memory: showing last 100 of 142 entries — older entries evicted`). Consider per-project memory partitions keyed by project id.

---

### Finding 6 — `recall_related` results carry no project attribution; cross-project note contamination at L1/L2

**Area:** recall
**Severity:** P2
**Evidence:** `mcp-servers/cortex-vault/tools/recall-related.js` lines 80–87: results include `path`, `title`, `score`, and `why` (keyword terms from note headings). The `why` field (lines 18–38) extracts terms from title and first 3 H2 headings — does not include the project folder name or any project identifier. `skills/cortex-boot/SKILL.md` lines 82–88: "Surface relevant hits in one short line before answering." The format example: `Worth knowing: you've already documented this pattern in [[_MOC]] and [[ywPortal SSO]].` — uses note titles only, no project context.
**Impact:** At L1 with 3 active projects, a query about "Stripe payment integration" surfaces notes from any project containing Stripe-related content — FKT checkout, Bubl payment flow, internal sales tool billing — all ranked by embedding similarity with no project label. The model sees titles like `[[2026-04-15 Stripe Sandbox Setup]]` without knowing which project it belongs to. Ben gets a "Worth knowing" line that may be irrelevant or actively misleading. The model must infer from the vault-relative path, which is buried in `path` but not presented in the surface hint.
**Suggested fix:** Include the first path segment after the vault root (i.e., the project folder name) in the `why` array or as a dedicated `project` field in the result. Surface it in the model's recall line: `Worth knowing (FKT): [[Stripe Sandbox Setup]]` so Ben immediately knows which project the note belongs to.

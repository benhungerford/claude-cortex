# Avatar 29 — Meeting-Marathon Day Audit

**Date:** 2026-06-01  
**Persona:** Meeting-marathon day — 7 back-to-back calls, batch transcript processing + threading load  
**Surface:** Claude Desktop  
**Model:** claude-sonnet-4-6

---

## Persona

A consultant or agency operator running seven back-to-back calls in a single day. By 5 PM they have transcripts queued from Granola/Fathom for every call, spanning at least three different client projects (and possibly two new ones). Their day-in-Cortex is almost entirely write-heavy: they need Cortex to process each transcript sequentially, thread series correctly across projects, extract decisions and blockers into the right hubs, and give them a clean status summary at end of day. Speed and accuracy of batched meeting writes is the daily bottleneck.

---

## Day Narrative

**Morning — Boot (L3 or L2)**

Ben opens Claude Desktop from his project repo (`fkt-checkout/`). The session-start hook fires, boot-context.py walks cwd, finds an L3 match, parses the FKT hub, and injects the `<cortex-session>` block. cortex-boot reads it and opens: _"FKT Shopify Website Build — Integrations stage. 2 open blockers: Stripe sandbox credentials; sandbox access expiring Friday. What are we tackling?"_

Session 1 is not for FKT work — it's a client call. He doesn't notice that L3 mode suppresses ambient capture by default (read-only contract, `references/activation-levels.md` L3 paragraph). He starts discussing a decision made on the morning call and Cortex watches silently, not logging, because no explicit trigger phrase was used. The decision drifts away uncaptured.

**Mid-morning — Batch transcript paste (calls 1–3)**

By 11 AM three Granola exports are in his clipboard. He pastes transcript 1. The `user-prompt-submit` hook fires, counts lines, detects speaker labels, tags it `cortex-process-meeting`. Good.

He immediately pastes transcript 2 without waiting for the first to complete. The hook fires again — correct. But here a subtle race condition surfaces: `post-tool-use` hook fires a background `reindex-one` child process for every `.md` file written by call 1, while the model is concurrently processing call 2's transcript and writing call 2's notes. Both processes open the same SQLite DB (`search-db.js` line 6: `new Database(dbPath)`). The WAL + `busy_timeout = 5000` (`lib/search-db.js` lines 16–18) gives 5 seconds grace — barely enough for sequential notes, but if two meeting notes are written in close succession the background reindex processes stack up and can hit the timeout, silently failing to index the new notes. The `|| true` on the reindex spawn line (`post-tool-use` line 207) means the failure disappears without any signal.

**Threading — The 3-note threshold cliff**

Call 2 is the third instance of "Bubl Shots Weekly Sync". `thread_meeting.js` checks `effectiveGroup.length < 3` (line 194) and only threads if there are 3+ entries. With exactly 3 it threads. But there's a subtlety: the new file must already be on disk before `thread_meeting` is called (line 220-229: `readFile(newFilePath)` returns null → isError). If `cortex-process-meeting` calls `thread_meeting` before writing the file, the tool returns `isError: true`. This is a sequencing trap the skill workflow doesn't explicitly guard against.

**Afternoon — Routing ambiguity (calls 4–5)**

Call 4 is a cross-project meeting touching both FKT and Bubl Shots. The skill routes to FKT (primary) and adds a `*Related:*` link to Bubl Shots. But `update_moc` (`tools/update-moc.js`) only knows how to insert under a named section heading using exact string match (line 26: `lines[i].trim() === sectionHeader`). If the MOC's section is "## Meeting Notes" but the meeting note is cross-project, there's no facility to add the cross-link entry to Bubl Shots' MOC from within the FKT-scoped call. The cross-link goes into the note footer but Bubl Shots' `_MOC.md` never gets updated. Discovery from Bubl Shots side is broken.

**End of day — Status sweep**

Ben says "what's the status of Bubl Shots?" The `user-prompt-submit` hook routes to `cortex-check-status` with high confidence. The skill reads the hub and Changelog. But three of today's decisions were extracted from transcripts processed in L3 (FKT) sessions, where the read-only contract silently suppressed ambient Tier-1 capture. Those decisions were never written. The status summary Ben sees is missing today's decisions — it's stale without any warning that this is the case.

**Stop hook — Session end**

The stop hook flushes `pending-memory.json`. But if the session was closed by the user clicking "New Chat" rather than a clean stop event, the stop hook may not fire at all on Claude Desktop, losing any pending memory queued during the session. No confirmation is shown.

---

## Findings

### Finding 1 — P0: L3 read-only default silently suppresses ambient capture — the core daily-use contract is inverted

**Evidence:** `references/activation-levels.md` lines 46-49: _"Default: read-only against the vault. Explicit user confirmation is required before writing from a repo-context session."_ The exception requires explicit trigger phrases. `capture-rules.md` Tier 1 table lists decision capture as "Always capture, silently" — but L3 overrides that without any indication to the user at session time.

**Impact:** On a meeting-marathon day, nearly every session starts in a repo cwd (L3). The user's highest-signal moments — decisions made mid-call while in the repo context — are silently dropped unless they happen to say "log that" or "we decided". The user expects ambient capture (the primary advertised Cortex behavior) but gets a quiet read-only mode. There is no per-session notice that L3 is suppressing ambient capture.

**Suggested Fix:** At the top of the L3 opening line, append a single parenthetical: _"(capture requires explicit trigger — say 'log this' to write)"_. Or reconsider whether the L3 read-only default should apply to Tier-1 decision signals at all; scope creep detection is the concern, not ambient decision capture. The activation-levels spec and capture-rules spec are in genuine conflict — resolve this design inconsistency and surface the active mode to the user.

---

### Finding 2 — P1: `thread_meeting` requires the file to already be on disk — any call-before-write sequence causes a silent isError

**Evidence:** `mcp-servers/cortex-vault/tools/thread-meeting.js` lines 219-229: `const newContent = readFile(newFilePath); if (newContent === null) { return { content: [...], isError: true }; }`. The skill workflow (`skills/cortex-process-meeting/SKILL.md`) says "Create the meeting note" (Step 3) then "Thread with previous meetings" (Step 4) — but the workflow doesn't explicitly state the file must be flushed to disk before calling `thread_meeting`. If the model calls `thread_meeting` immediately after the `Write` tool but before the OS has flushed the inode (rare but possible with high I/O from batch processing), or calls it out of order, threading silently fails.

**Impact:** On a 7-transcript batch day, threading breaks for some meetings without any user-visible error. The user ends up with unlinked meeting series. Discovering this requires manually inspecting the footer of every new note.

**Suggested Fix:** Add a check in `thread_meeting` handler: if `newContent === null`, retry once after a 50ms sleep before returning isError. More robustly, the skill workflow should explicitly state "call `thread_meeting` only after confirming the file exists on disk" and the tool description should surface the prerequisite.

---

### Finding 3 — P1: Concurrent batch transcript processing causes stacked background reindex processes that silently timeout on SQLite write contention

**Evidence:** `hooks/post-tool-use` lines 196-208: every `.md` write spawns a background `node reindex-one.js` process. `lib/search-db.js` line 17: `db.pragma('busy_timeout = 5000')` — 5 seconds. `post-tool-use` line 207: `(node "$REINDEX_BIN" ... >/dev/null 2>&1 &) || true` — failures are swallowed. On a batch day, pasting 7 transcripts in rapid succession creates N×(notes per meeting) background reindex processes simultaneously, each fighting for WAL write access.

**Impact:** Several of the day's meeting notes are never indexed in the semantic DB. `recall_related` and `search_vault` return no hits for today's meetings. When the user asks "what did we decide about Stripe today?", semantic search returns nothing. The vault is written correctly on disk but search is silently stale.

**Suggested Fix:** Replace the fire-and-forget spawn with a bounded reindex queue (max 2 concurrent reindex workers). Alternatively, batch the reindex after the full transcript-processing session rather than per-file. At minimum, surface a warning when `reindex-one` fails: write a flag file that the next session-start hook can detect and announce: _"Note: X meeting notes from the last session may not be searchable yet — reindex in progress."_

---

### Finding 4 — P1: Cross-project meetings do not update the secondary project's MOC — discovery from the non-primary side is broken

**Evidence:** `tools/update-moc.js` handler takes a single `moc_path` argument (line 52). `skills/cortex-process-meeting/SKILL.md` Example 3 describes cross-linking with `*Related:*` and bidirectional hub links but says "Add a reciprocal link from Bubl Shots's hub back to this meeting note" — this is a hub edit, not an MOC edit. Neither the SKILL nor the `update_moc` tool has a path to updating the secondary project's `_MOC.md` with the cross-project meeting entry.

**Impact:** On a marathon day with cross-project calls (common when working across multiple clients), the secondary project's MOC is stale. A user navigating Bubl Shots' `_MOC.md` in Obsidian won't see the meeting that touched their project. Over time, the secondary project's meeting history becomes invisible from inside that project's context.

**Suggested Fix:** The `cortex-process-meeting` workflow should explicitly call `update_moc` twice for cross-project meetings: once for the primary project's MOC and once for each secondary project's MOC, under a dedicated section (e.g. `## Cross-Project Mentions`). The SKILL.md worked example should show this explicitly.

---

### Finding 5 — P2: The `extractWhy` function in `recall_related` reads files on every call — high latency during heavy meeting-processing sessions

**Evidence:** `mcp-servers/cortex-vault/tools/recall-related.js` lines 18-38: `extractWhy` calls `fs.readFileSync(abs, 'utf8')` synchronously inside a `.map()` for every result returned (up to `limit` results). On a large vault, this is 5 synchronous disk reads per `recall_related` call. `cortex-boot` SKILL.md line 82 says `recall_related` is called "at the start of a new task, when the user mentions a vendor/tool/pattern, or when hitting a blocker" — potentially several times per meeting transcript session.

**Impact:** During batch transcript processing, `recall_related` is called for each of the 7 transcripts (or more, for blockers surfaced mid-processing). Each call hits disk for the `why` extraction, adding latency on top of an already-heavy I/O session. On a slow disk or a large vault (500+ notes), this becomes a noticeable pause per transcript.

**Suggested Fix:** Cache the `why` terms in the SQLite DB at index time (a `why_terms` column in the `notes` table), populated by `upsertNote` in `lib/indexer.js`. The `extractWhy` function then becomes a DB read instead of a disk read, reducing latency by an order of magnitude. Fallback to the current disk-read approach if the column is missing (migration safety).

---

### Finding 6 — P2: The 8,000-character token budget truncates the project hub at the exact moment it is most needed — the L3 boot for a complex project mid-marathon

**Evidence:** `hooks/lib/boot-context.py` line 265: `DEFAULT_BUDGET_CHARS = 8000`. Priority order in `apply_token_budget` (lines 317-324): project comes first, but if the project dict is large (many blockers, long recent_decisions strings), the budget truncation stubs it: lines 343-352 replace the full project dict with a `_truncated: True` subset capped at 3 blockers, 3 open questions, 3 recent decisions. On a marathon day the user's FKT hub might have 8 open questions, 5 recent decisions, and a long stage description — all trimmed to 3.

**Impact:** When cortex-boot opens the L3 session greeting at call 7, it may say "2 open blockers" when there are actually 5 because the hub was truncated at boot. The user makes a decision in the next session based on incomplete blocker state. This is a correctness issue disguised as a performance optimization — the budget silently degrades context accuracy with no visible warning beyond the `_truncated: true` flag (which is never surfaced to the user).

**Suggested Fix:** When `_truncated: true` is set on the project dict, the cortex-boot SKILL.md should explicitly instruct: surface a one-line note at the end of the L3 greeting: _"(hub truncated for context budget — say 'read hub' to load full state)"_. This preserves the budget benefit while preventing silent staleness from masking open blockers.

---

## Summary Table

| # | Title | Area | Severity |
|---|---|---|---|
| 1 | L3 read-only silently suppresses ambient Tier-1 capture | activation | P0 |
| 2 | `thread_meeting` requires file on disk before call — pre-write sequences cause silent isError | meeting | P1 |
| 3 | Batch reindex processes contend on SQLite WAL, silently fail, leaving notes unsearchable | perf | P1 |
| 4 | Cross-project meetings don't update secondary MOC — secondary side discovery broken | meeting | P1 |
| 5 | `extractWhy` reads disk synchronously per-result on every `recall_related` call | perf | P2 |
| 6 | Token-budget hub truncation silently caps blockers/decisions at L3 boot without user signal | boot | P2 |

---
avatar: "05"
persona: "Management consultant, 5+ client meetings/day, Granola+Fathom transcripts to file"
surface: "Claude Desktop"
audit_date: 2026-06-01
auditor: claude-sonnet-4-6
---

# Avatar 05 — Daily Use Audit

## Persona

**Name:** Alex (composite)
**Role:** Management consultant at a 4-person strategy firm
**Vault:** 25+ active client projects spanning M&A diligence, brand strategy, ops improvement
**Rhythm:** 5-6 client meetings/day. After each meeting, immediately files notes from Granola (AI meeting notes) or Fathom (video-recorded calls). Asks status questions dozens of times per day across multiple clients. Rarely sits in a project repo — cwd is almost always `~/Documents` or an ad-hoc folder. Uses Claude Desktop for all Cortex interactions.

---

## Simulated Day

**7:45 AM — Session opens.** Alex opens Claude Desktop from `~/Documents`. No project repo, so `boot-context.py` computes L1 passive. The `<cortex-session>` block arrives with personality and the last 15 lines of `_changelog.txt`. Cortex says nothing. Alex types: *"quick status on Hartley Group before the 8 AM call."*

`user-prompt-submit` hook fires. The phrase "status on" matches the 3f pattern and injects `<cortex-hint>likely-skill: cortex-check-status`. The model calls `read_hub`. The MCP tool's `extractOpenQuestions` and `extractBlockers` parse the hub using `- [ ]` checkbox syntax, while `boot-context.py`'s `parse_hub` function parses the same hub using a **pipe-table** "Open Questions & Blockers" section. If Alex's hub was produced by the boot-context path and now lives in table format, `read_hub` returns zero blockers. Alex walks into the 8 AM call with a false "no open blockers" answer.

**9:10 AM — Post-call, file Granola transcript.** Alex pastes the Granola export into Claude. The `user-prompt-submit` hook checks `LINE_COUNT` and `SPEAKER_COUNT` and correctly routes to `cortex-process-meeting` via the structural transcript trigger. But the speaker-label regex is `^[A-Za-z]+: ` — Granola exports names like `"Alex Chen:"` (multi-word with space). This fails the single-word name regex. LINE_COUNT may be ≥ 20, but `SPEAKER_COUNT` hits 0, so the hard-route is skipped. Alex has to manually say "process this meeting" to trigger filing.

**10:30 AM — Second client, Fathom transcript.** Alex uses the Fathom MCP to pull the transcript directly (`mcp__84b6da68__get_meeting_transcript`). The trigger-phrases spec (row 14) says this is a hard-route to `cortex-process-meeting`. But the `user-prompt-submit` hook only pattern-matches against the user's typed prompt — it has no awareness that an MCP tool returned a transcript in the current turn. If Alex types *"pull the transcript for the Dumont call"*, the hook fires on prompt text only ("pull" doesn't match any pattern), and no `<cortex-hint>` is injected. The model must independently notice the Fathom transcript in the response and fire `cortex-process-meeting` without the hook's nudge. When the MCP server isn't loaded (Claude Desktop without the plugin active), the recall fails silently.

**12:15 PM — Quick status: "what's blocking Hartley on the ops piece?"** The check-status skill calls `read_hub` via MCP. `read_hub` calls `extractSection(body, 'Open Questions')` — exact string match on section header `## Open Questions`. If the hub template uses the full name `## Open Questions & Blockers`, this section is never found and `read_hub` returns `open_questions: []` even when blockers exist. Alex is told there are no open questions when there are two.

**1:45 PM — 6th meeting of the day, pasting a lightly-edited summary (not a raw transcript).** Summary is 18 lines, no speaker labels — pure prose bullet points. `LINE_COUNT` is 18, below the 20-line threshold. The hook routes nowhere. The structural transcript trigger misses the paste. Alex says nothing special. Cortex captures nothing. The two decisions from that meeting are lost.

**3:00 PM — Filing five meetings in rapid succession.** Each `cortex-process-meeting` invocation calls `thread_meeting`. Threading requires at least 3 prior notes in the series (`effectiveGroup.length < 3`). Alex's newer clients have only 1-2 prior meeting notes. All five meetings come back "need at least 3 to thread — skipping." After the 3rd, Alex wonders if threading is broken.

**4:30 PM — Memory flush.** Alex closes the session. The `stop` hook fires, checks `pending-memory.json`, and appends entries to `memory.md`. But `memory.md` grows unbounded — the stop hook only appends, never deduplicates or compacts. The boot-context reader tail-caps at 100 lines (`--memory-cap 100`). After weeks of use at 5+ meetings/day, the tail of `memory.md` may be saturated with stale or redundant entries, crowding out older signal-bearing facts.

**5:00 PM — Recall stale.** Embedding model `Xenova/all-MiniLM-L6-v2` is loaded on first `recall_related` or `search_vault` call via `@huggingface/transformers`. On a cold MCP server start, the first semantic search adds model-download latency (potentially 5-20 seconds depending on cache). The `getExtractor()` call is lazy-loaded but the promise is module-level, so only the first call per MCP server process bears this cost. However, MCP servers restart between Claude Desktop sessions, so Alex pays this on every day's first recall.

---

## Findings

### Finding 1 — Hub schema split: `read_hub` and `boot-context.py` parse incompatible section formats

**Area:** status
**Severity:** P0

**Evidence:**
- `hooks/lib/boot-context.py:206-224`: parses blockers from a **Markdown table** under `## Open Questions & Blockers`. Looks for 5-cell table rows; classifies rows with `type in ("Dependency", "Internal", "Unknown")` as blockers.
- `mcp-servers/cortex-vault/tools/read-hub.js:44-62`: parses `## Open Questions` (different section name) and `## Blockers` (separate section) as **checkbox lists** (`- [ ]` lines).

These are two separate parsers for the same hub concept, expecting completely different Markdown structures. A hub written via `cortex-update-context`'s table convention will return empty results from `read_hub`, and vice versa. During a live status check — the most frequent daily action — `cortex-check-status` calls `read_hub` via MCP. If the hub uses the table format (which boot-context expects), the MCP tool returns `open_questions: []` and `blockers: []`, producing a false "no blockers" status.

**Impact:** Silent wrong answer on the most-used daily workflow (status check). For a consultant heading into a client call, a missed blocker is a credibility and risk issue.

**Suggested fix:** Unify the hub section format in one canonical spec. Pick either table or checklist, update both parsers to match, and add a schema-validation test that both parsers return the same results against a shared fixture hub.

---

### Finding 2 — Transcript trigger misses multi-word speaker names (Granola exports)

**Area:** capture
**Severity:** P1

**Evidence:**
- `hooks/user-prompt-submit:63`: speaker detection regex is `^[A-Za-z]+: ` (single-word name followed by colon-space).
- Granola AI-meeting-notes exports use participant full names: `Alex Chen: Good morning.` or `Dr. Priya Nair: Let me pull up the deck.` These contain spaces or dots, both of which fail `[A-Za-z]+`.
- Fathom exports similarly produce `First Last:` style speaker labels.

**Impact:** The hard-route structural transcript trigger silently fails for the dominant transcript format (Granola, Fathom). Alex pastes a 60-line transcript and nothing routes to `cortex-process-meeting`. The meeting is not filed unless Alex manually types "process this meeting." A consultant with 5+ meetings/day and mental context overload will occasionally skip the manual trigger and lose the filing entirely.

**Suggested fix:** Extend the regex to `^[A-Za-z][A-Za-z .'\\-]+:\s` to match multi-word names with common punctuation (periods, hyphens, apostrophes). Also consider Granola's JSON export format, which may arrive via MCP as structured data rather than pasted text.

---

### Finding 3 — `read_hub` section name mismatch silently returns empty blockers

**Area:** status
**Severity:** P1

**Evidence:**
- `mcp-servers/cortex-vault/tools/read-hub.js:45`: `extractSection(body, 'Open Questions')` — exact case-sensitive match on `## Open Questions`.
- `mcp-servers/cortex-vault/tools/read-hub.js:55`: `extractSection(body, 'Blockers')` — separate section call.
- `skills/cortex-process-meeting/SKILL.md:122-124` and `skills/cortex-update-context/SKILL.md:62`: both describe a unified `## Open Questions & Blockers` hub section.
- `workflows/process-meeting.md` Step 5: writes to "Open Questions table" without specifying exact heading.
- `boot-context.py:206`: regex targets `## Open Questions & Blockers`.

The hub template uses `## Open Questions & Blockers` as a combined section, but `read_hub` looks for `## Open Questions` and `## Blockers` as separate sections. Neither matches the template section name. Result: `read_hub` always returns `open_questions: []` and `blockers: []` when the hub follows the standard template.

**Impact:** Every `cortex-check-status` call via the MCP path (which is the preferred path per the skill's own instructions) returns a false empty state. Compound with Finding 1 for a complete status-check reliability failure.

**Suggested fix:** `read_hub` should look for either `## Open Questions & Blockers` (combined) or the separate names as a fallback. The combined case should parse rows with a `Type` column to split into questions vs blockers, matching the `boot-context.py` logic.

---

### Finding 4 — `thread_meeting` requires 3 prior notes; a consultant's newer clients never thread

**Area:** meeting
**Severity:** P2

**Evidence:**
- `mcp-servers/cortex-vault/tools/thread-meeting.js:194-199`: `if (effectiveGroup.length < 3) { return { content: [{ type: 'text', text: 'Series "..." has N note(s) — need at least 3 to thread. Skipping.' }] } }`.
- The threshold is hardcoded. No rationale comment explains why 3 and not 2.
- `skills/cortex-process-meeting/SKILL.md:72`: threading rule says "A series exists when: 3 or more meetings in the same folder share a stable title suffix" — this documents the threshold, but doesn't justify it.

**Impact:** A consultant with newer clients always has 1-2 notes before the 3rd meeting fires threading. The first two meetings of every recurring series produce zero thread links. From the user's perspective, every series appears to start at meeting 3. For a high-volume persona (5+ clients, each with multiple recurring series), most meetings in the first month will silently skip threading with no visible explanation. The "Skipping" message is only returned to the model — the user sees nothing in chat.

**Suggested fix:** Lower threshold to 2 (thread when there is at least 1 prior note in the same series). The threading concept is sound with 2; the value of `*Previous:*` links starts at meeting 2, not meeting 3. Update the SKILL.md rule accordingly.

---

### Finding 5 — `memory.md` grows unbounded; stop hook only appends, never compacts

**Area:** boot
**Severity:** P2

**Evidence:**
- `hooks/stop:138-170`: reads `pending-memory.json`, opens `memory.md` in append mode (`'a'`), writes each entry with no deduplication check.
- `hooks/lib/boot-context.py:45-57`: `read_memory` tail-caps at 100 lines by default (`cap=100`). Older lines beyond the cap are silently dropped from the session context.
- There is no deduplication, compaction, or TTL logic anywhere in the stop hook or in any scheduled maintenance task.

**Impact:** For a management consultant writing 5+ meetings/day, each session will generate multiple memory updates. After 4-6 weeks of use, the 100-line tail of `memory.md` will be dominated by recent (possibly redundant) session fragments, and older stable facts (client preferences, recurring patterns, key contacts) fall off the tail and are silently lost from each session's context. The user experiences this as Cortex "forgetting" things they've told it repeatedly.

**Suggested fix:** Add a memory compaction pass to the stop hook or a periodic maintenance command. At minimum, deduplicate exact-match lines before appending. Longer term, add a `cortex-compact-memory` maintenance skill that summarizes the oldest N lines into a stable "facts" section at the top and a rolling "recent" tail below.

---

### Finding 6 — Embedding model cold-load on every Claude Desktop session start adds latency to first recall

**Area:** perf
**Severity:** P2

**Evidence:**
- `mcp-servers/cortex-vault/lib/embeddings.js:7`: `let extractorPromise = null;` — module-level singleton, but the MCP server process is new per Claude Desktop session start.
- `embeddings.js:9-16`: `getExtractor()` lazy-loads `@huggingface/transformers` and downloads/caches `Xenova/all-MiniLM-L6-v2` on first call. The model is ~23MB; download is one-time, but the `pipeline()` initialization on a cold cache still takes several seconds.
- `skills/cortex-boot/SKILL.md:72-88`: `recall_related` should fire on the first substantive task each session. For a consultant starting the day with "quick status on Hartley," the very first `recall_related` call hits the cold loader.

**Impact:** The first semantic recall or search vault call each session silently hangs for 2-10 seconds before returning. The user experiences a lag on the first contextual answer of the day with no feedback. A consultant with time pressure before a client call will interpret this as Claude being slow or the feature being broken.

**Suggested fix:** Warm the embedding extractor at MCP server startup by invoking `getExtractor()` eagerly in `server.js` before the first tool call arrives. This shifts the latency to process startup (invisible to the user) rather than the first user-visible query. Alternatively, add a progress note in the tool response when model initialization takes >2 seconds: `"(initializing semantic search — one moment)"`.

---

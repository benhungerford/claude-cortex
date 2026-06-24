---
avatar: 21
persona: Power user — 15k-note vault, stress-tests boot token budget and index/recall latency at scale
surface: Claude Code CLI
date: 2026-06-01
auditor: claude-sonnet-4-6
---

# Avatar 21 — Stress-Test Power User Audit

## Persona

Power user with a 15,000-note Obsidian vault across dozens of active and archived projects. This user has been with Cortex long enough to have a bloated `memory.md`, a `personality.md` with many buckets, a `_changelog.txt` well into the thousands of entries, and a `search.db` that must embed 15k notes. The primary daily concerns are: will boot be fast and under token budget? Will `recall_related` return useful results or garbage? Will the post-tool-use re-index hook keep up with heavy editing sessions? Will `cortex-process-meeting` thread correctly when a series has 100+ prior notes in the folder?

---

## Simulated Day-in-the-Life

**08:45 — Session starts in a registered repo (L3)**

The `session-start` hook fires `boot-context.py`. It opens `personality.md` (likely large after months of use), reads `memory.md` (capped at 100 lines, fine), reads the last 15 lines of `_changelog.txt` (fine), counts `_Inbox/` files (fine), and reads the registry + project hub. The token-budget system applies an 8,000-character ceiling. On a 15k-note vault that has been active for a year, `personality.md` alone can exceed 4,000 chars. With hub data, memory, and changelog all competing for the remaining ~4,000 chars, silent truncation hits regularly — but the `_budget.hint` only says "Read the full content via the MCP tools." Claude never surfaces this to the user, so the power user silently receives a degraded boot context every morning without knowing it.

**09:10 — First `cortex-process-meeting` for a 30-meeting series**

User pastes a Granola export for "FKT Standup — 2026-06-01". The `user-prompt-submit` hook detects the structural transcript pattern (20+ lines, 3+ speaker labels) and injects a `cortex-hint`. `cortex-process-meeting` fires and calls `thread_meeting`. The tool lists all files in the `Notes/` directory with `readdirSync`, groups by title suffix, and requires `effectiveGroup.length >= 3` to thread. With 30 prior standups in the folder, the group scan is trivial. But `addNextLink` edits the prior note — triggering `post-tool-use` again, which calls `reindex-one.js` in the background. With 15k notes already indexed, the background re-index of one file is fast. No latency problem here.

However, the speaker-label detection pattern (`grep -cE '^[A-Za-z]+: '`) is brittle for real Granola exports where speaker names have spaces ("Ashley Chen: ..."), making the structural hard-route miss and forcing the user to manually type "process this meeting".

**10:30 — Status check across two projects**

User asks "what's the status of FKT?" — `cortex-check-status` fires, calls `read_hub`. The `read_hub` tool uses `extractOpenQuestions` which scans for `- [ ]` checkbox lines. But `boot-context.py`'s `parse_hub` function parses an entirely different format: it reads a Markdown pipe-table under `## Open Questions & Blockers`. These are two different parsers reading the same hub section with two different assumptions about format — table in `boot-context.py`, checkbox list in `read-hub.js`. Whichever format the user's hub actually uses, one of these parsers will return zero results while the other works correctly.

**11:15 — Ambient recall fires during a code discussion**

User mentions "we need to wire up the webhook receiver for Sage". `cortex-boot` calls `recall_related` with `limit: 5`. The `embed()` call loads `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers`. On first call per MCP server process lifetime, this cold-starts the model pipeline (`extractorPromise = null` → `pipeline('feature-extraction', MODEL_ID)`). On a 15k-note vault the DB open + kNN query itself is fast (WAL mode, busy_timeout 5s), but the model cold-start takes 2–6 seconds the first time per process start. That's invisible latency inserted before the user's response, with no feedback.

**14:00 — Bulk vault edit (move 20 notes between folders in Obsidian)**

Post-tool-use hook fires for each `mcp__obsidian__move_note` call (matcher includes it). For each move: the hook reads stdin, resolves vault path from cache, appends to `_changelog.txt`, then spawns a background `reindex-one.js`. With 20 notes moved, that's 20 parallel background Node processes each opening and writing to `search.db`. The WAL mode and `busy_timeout = 5000` should handle contention, but 20 concurrent writers to a SQLite WAL file is stress not covered by the happy-path 5s timeout at scale — a `SQLITE_BUSY` that exceeds 5s will silently swallow the re-index for that file with `|| true`, leaving the index stale without any feedback.

**16:30 — Full reindex after bulk move**

User runs `/cortex-index`. `indexVault` walks the vault with synchronous `readdirSync` in a fully synchronous `walk()` call, then processes files in a `for...of` loop with `await upsertNote(...)` — fully sequential embedding. At 15k notes with most unchanged (skipped via hash check), this is mostly fast I/O. But for the first run after a fresh `search.db` delete, embedding all 15k notes sequentially at ~50ms each would take ~12 minutes. There's no concurrency, no progress UI (the `onProgress` callback is consumed by the server-side handler but its output is not streamed to the user), and no estimate shown. The user sees nothing until a final JSON blob.

**17:45 — Memory flush at stop hook**

`stop` hook fires. Reads `pending-memory.json`, appends to `memory.md` with simple `f.write('\n' + content + '\n')`. No deduplication: if the same fact was queued twice (e.g. from two parallel tool calls), both get appended. Over months on a high-activity vault, `memory.md` grows unboundedly — only the most recent 100 lines are loaded at boot via the `--memory-cap 100` default, but the file itself keeps growing. When it hits tens of thousands of lines, even just reading it for the tail takes time, and the write path has no size guard.

---

## Findings

### 1. Hub section parser mismatch between boot-context.py and read-hub.js (P0)

**Evidence:** `hooks/lib/boot-context.py:205-224` parses `## Open Questions & Blockers` as a pipe-table and extracts rows with 5 cells. `mcp-servers/cortex-vault/tools/read-hub.js:44-56` (`extractOpenQuestions`, `extractBlockers`) looks for `- [ ]` checkbox lines under `## Open Questions` and `## Blockers` respectively — two separate sections, checkbox format.

**Impact:** These two parsers implement different assumptions about what the hub file looks like. If the vault uses the pipe-table format (as shown in `boot-context.py` and the `parse_hub` worked example), `read_hub` returns zero open questions and zero blockers for every `cortex-check-status` call. Conversely, if the vault uses checkbox lists, `boot-context.py` returns zero blockers at boot. At a 15k-note vault scale where projects accumulate years of hub history, this means either the L3 boot summary or the live status check (or both) silently shows an empty blocker list — a data correctness failure during the most important daily touchpoints.

**Suggested fix:** Unify on one format. The pipe-table approach in `boot-context.py` is richer (captures type/owner/status columns). Port the same regex-based table parser into `read-hub.js::extractOpenQuestions` and `extractBlockers`, or extract a shared `parse-hub-sections.js` module used by both. Update `vault-conventions.md` and the hub template to document the canonical format explicitly.

---

### 2. Token budget truncates silently — user never learns context is degraded (P1)

**Evidence:** `hooks/lib/boot-context.py:291-365` (`apply_token_budget`). When content overflows the 8,000-char budget, it sets `output["_budget"] = {"hint": "Read the full content via the MCP tools..."}`. `hooks/session-start:49-112` serialises the JSON into the `<cortex-session>` block but the `_budget` key is never emitted into the human-readable block — it's buried inside the raw JSON that the hook never pipes to Claude's visible context. `cortex-boot/SKILL.md` has no instruction to check for `_budget.truncated` and tell the user.

**Impact:** A power user with a large `personality.md` (many buckets, rich sub-note type definitions) hits truncation on nearly every session. Memory, learner profile, and active-project list get silently dropped. The L3 boot line may show "2 open blockers" from the (truncated) hub while the full hub has 5. The user notices inconsistencies over time ("Cortex missed that blocker again") but has no way to diagnose why.

**Suggested fix:** When `_budget.truncated` is non-empty, emit a single line into the session block at boot: `[Context budget: personality/memory truncated — some context omitted. Run /cortex-status for full details.]`. Also: expose `--budget-chars` as a documented config key in `config.json` so power users can tune it.

---

### 3. recall_related model cold-start inserts silent multi-second latency (P1)

**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js:6-16`. `extractorPromise = null` at module load; first call to `getExtractor()` does `pipeline('feature-extraction', MODEL_ID)` — a full model load. `recall-related.js:61` calls `embed(truncated)` before doing anything else. The MCP server process persists across tool calls within a session but restarts between sessions. So every new session's first `recall_related` (which `cortex-boot` fires at the start of any substantive task) blocks on model load.

**Impact:** On macOS with no GPU acceleration, `Xenova/all-MiniLM-L6-v2` cold-start takes 2–6 seconds. This delay is inserted silently before the user's first task response when ambient recall fires. The `cortex-boot` skill has no instruction to skip recall on the very first turn (where the model is cold) or to surface a "loading embeddings…" notice. At scale (15k notes, recall called multiple times per session), this is the most user-visible latency in the daily loop.

**Suggested fix:** Warm the embedding model eagerly at MCP server startup (call `getExtractor()` once in a fire-and-forget `setTimeout(() => getExtractor(), 0)` at `server.js` init). This amortises the cold-start against the session-start hook delay, making it effectively invisible.

---

### 4. Transcript speaker-label detection misses multi-word names (P1)

**Evidence:** `hooks/user-prompt-submit:62-63`. The structural transcript detector uses `grep -cE '^[A-Za-z]+: '` — this matches only single-word speaker labels ("Ben:", "Ashley:"). Real Granola and Fathom exports use full names ("Ashley Chen:", "Ben Hungerford:") and sometimes timestamp-prefixed labels ("[00:01] Ashley:"). A 30-meeting series power user who uses Granola daily will never hit the hard-route auto-detection; they must always type "process this meeting" explicitly.

**Impact:** The structural hard-route is a key quality-of-life feature for the daily meeting loop. Missing it means the user must remember to invoke the skill manually, defeats the ambient-intelligence premise, and the hint injected by the hook (which boosts skill routing confidence) is never generated.

**Suggested fix:** Broaden the regex to `'^[A-Za-z][A-Za-z ]+: '` (allows spaces in names, requires at least 2 chars), and also accept `'^\[\d{2}:\d{2}\]'` timestamp prefixes. Cap the match at reasonable name length (e.g. <= 40 chars before the colon) to avoid false positives on markdown tables.

---

### 5. Full vault reindex is sequential — 15k notes could take 12+ minutes with no progress feedback (P2)

**Evidence:** `mcp-servers/cortex-vault/lib/indexer.js:111-155` (`indexVault`). The `for...of` loop at line 130 `await`s each `upsertNote` call sequentially. The hash-check at line 77–80 short-circuits unchanged notes cheaply, so incremental runs are fast. But a cold rebuild (after `search.db` delete, or a fresh install on an existing vault) must embed every file. At 15k notes × ~50ms per embed = ~12.5 minutes. The `onProgress` callback at line 135 is wired up in `reindex-vault.js:handler` as a no-op `() => {}` (line 15 of reindex-vault.js). The user sees no output until completion, and can't tell if it hung.

**Impact:** The first `/cortex-index` on a large vault appears to hang. The power user who deletes a corrupt `search.db` and reruns the index will wait 10+ minutes for a silent process, likely Ctrl-C mid-run, leaving a partially-indexed DB.

**Suggested fix:** (a) Wire the `onProgress` callback to stream periodic counts to the MCP tool response (or log to stderr so it appears in Claude Code's tool output). (b) Increase embedding concurrency with a simple semaphore allowing e.g. 4 concurrent embeds — the MiniLM model is CPU-bound but Node can pipeline I/O around it.

---

### 6. Concurrent post-tool-use re-indexers can silently drop on SQLite BUSY at scale (P2)

**Evidence:** `hooks/post-tool-use:207` spawns `node "$REINDEX_BIN" "$VAULT_PATH" "$REL_PATH"` in a subshell with `|| true`. `mcp-servers/cortex-vault/lib/search-db.js:17` sets `busy_timeout = 5000` (5 seconds). During a bulk Obsidian move (20 notes), 20 concurrent `reindex-one.js` processes all open the same `search.db` WAL file. SQLite WAL allows concurrent readers but only one writer at a time. If any writer waits more than 5 seconds (plausible when 19 others are queued), the `SQLITE_BUSY` error is swallowed by `|| true` at the shell level and by the silent `try/catch` pattern in Node — that note's embedding is silently stale.

**Impact:** After a bulk vault reorganisation (common on a 15k-note vault), semantic search returns stale results for moved notes until the next manual `/cortex-index`. The user has no indication this happened. On a power user's vault this can mean weeks of subtly wrong recall results before they notice.

**Suggested fix:** Replace the fire-and-forget background spawn with a debounced queue: write the dirty paths to a `pending-reindex.json` file (appended atomically), then the stop hook (or a periodic timer) processes them in a single serialised `reindex-one` pass. This collapses N concurrent writers into 1 sequential writer and eliminates the BUSY race entirely.

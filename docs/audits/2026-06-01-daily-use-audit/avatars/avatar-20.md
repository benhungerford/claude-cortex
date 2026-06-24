---
avatar_id: "20"
persona: "Multi-device user (laptop + desktop) with vault on iCloud/Dropbox; sync collisions mid-day"
surface: Claude Desktop
audit_date: 2026-06-01
auditor: claude-sonnet-4-6 (subagent)
---

# Daily-Use Audit — Avatar 20

## Persona

Multi-device knowledge worker. Vault lives at `~/Documents/The Vault` on both a MacBook Pro (laptop, primary) and an iMac (desktop). The vault folder sits inside an iCloud Drive-synced `Documents` directory. Some days both machines are active at once. Dropbox was used historically and the vault folder name still reflects that; iCloud Drive is current.

The user processes 2-4 Fathom/Granola meeting recordings per day, makes scope/blocker decisions mid-conversation, and runs `cortex-check-status` several times a day to stay oriented across 4-6 live projects. They switch between the laptop (mobile work, calls) and the desktop (deep work, after-hours) and expect Cortex state to be consistent on both machines by the time they open Claude Desktop each morning.

---

## Simulated Day-in-the-Life

**7:45 AM — Desktop, session open**
The iMac boots Claude Desktop. The session-start hook fires, calling `boot-context.py`. The vault is on iCloud Drive. Last night the laptop wrote a new meeting note and updated `memory.md`. iCloud has synced those files to the desktop by now. Boot reads `personality.md`, resolves cwd to the FKT Shopify project (L3), and injects the cortex-session block. The L3 opening line appears: "FKT Shopify Website Build — Integrations stage. 2 open blockers." Good start.

**9:10 AM — Desktop, Fathom meeting processed**
A 45-minute client call ended via Fathom. The user copies the Fathom export. The Fathom export uses `**Ashley:** text` markdown speaker format and `Ben Hungerford: text` (full name). The user pastes the 85-line transcript. The `user-prompt-submit` hook fires: it counts lines (≥ 20 threshold met), then runs `grep -cE '^[A-Za-z]+: '` to count speaker lines. Every Fathom speaker label fails the regex because they are either `**Name:**` or `First Last:`. Count = 0. The skill hint is NOT injected. The model receives no routing hint for `cortex-process-meeting`. The model still *may* recognize the transcript visually, but the deterministic routing layer silently misses the hard-route signal.

**10:30 AM — Desktop, decision captured**
User says "we're going with Shopify Markets instead of a subdomain setup." The `user-prompt-submit` hook catches `"we're using "` and injects a `cortex-update-context` hint. The skill fires correctly, reads the FKT hub, finds no conflict, writes the decision. The `post-tool-use` hook fires on the `Edit` call; it appends to `_changelog.txt` atomically via the Node CLI, then spawns a background re-embed in a subshell. Clean.

**12:15 PM — Both machines active (laptop wakes from sleep)**
The user opens Claude Desktop on their MacBook. The session-start hook fires. At the same moment, the desktop's background reindex job (spawned from the 10:30 AM `post-tool-use` hook) is writing to `.cortex/search.db` via WAL mode. iCloud has partially synced `search.db` from the laptop (the laptop had its own reindex running last week). Two concurrent SQLite WAL writers targeting the same `search.db` on two machines via iCloud Drive — iCloud does not provide POSIX file locking across devices. The 5-second `busy_timeout` in `search-db.js` cannot protect against cross-machine lock failures because iCloud's sync is not a real filesystem. The laptop session's `recall_related` call returns a `SQLITE_CORRUPT` or `SQLITE_BUSY` error silently; the error is swallowed by the `try/finally` block and Cortex returns zero results with no user-visible explanation.

**12:30 PM — Laptop, status check**
User asks "what's the status of Bubl Shots?" The L3 session block on the laptop was injected at boot from a hub snapshot taken at 12:15 PM. The FKT hub was updated 2 hours ago on the desktop. The `activation-levels.md` spec says L3 should "read the project hub on every turn (not cached)." In practice, the hub data in the session block is not refreshed per-turn — the hook only reads it at `session-start`. The `cortex-check-status` skill correctly reads the hub fresh via `mcp__cortex-vault__read_hub`, but the L3 "not cached" guarantee in the spec is misleading: the *opening session line* (blocker count) is stale for the rest of the session.

**2:00 PM — Laptop, memory flush at session end**
The user closes the laptop's Claude Desktop window. The Stop hook fires. It reads `pending-memory.json` and appends updates to `memory.md` non-atomically (bare `f.write()` in a Python loop, `open(memory_file, 'a')`). At this exact moment, iCloud is syncing `memory.md` from the desktop (which was updated 30 minutes ago). iCloud can generate a conflict copy: `memory.md (Ben's MacBook Pro's conflicted copy 2026-06-01).md`. The stop hook's `f.write()` writes into the local file; iCloud creates a conflicted copy. The conflicted copy ends in `.md` and is inside the vault — the `indexer.walk()` function picks it up on the next full reindex and embeds it as a real note. It will surface in `recall_related` results, polluting semantic search with duplicate memory fragments.

**3:30 PM — Desktop, second session**
The desktop's `session-start` hook fires again. The `session-cache` directory has a single shared `vault-path.txt` — no per-session namespacing. This is fine for a single-device scenario. The vault-path is still correct. But `pending-memory.json` from a *previous desktop session* (that crashed before the Stop hook could run) is still present. The new session doesn't know the pending memory was from a prior session. The Stop hook at the end of this new session will flush stale pending memory from 3 hours ago into `memory.md`, potentially re-appending facts that were already written by the laptop's stop hook.

**5:45 PM — Desktop, Dropbox conflict copy indexed**
The previous day, Dropbox created a conflict copy: `2026-05-31 FKT Standup (Ben's MacBook Air's conflicted copy).md`. This filename ends in `.md` and its parent directory is `Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/` — not hidden, not in `_Templates` or `Archives`. The `indexer.walk()` function includes it in the full index run. The `thread_meeting.js` tool only processes files matching `YYYY-MM-DD Title.md` format — the conflict copy doesn't match, so threading is safe. But the conflict copy IS embedded as a real note and will surface in `recall_related` for any FKT-related query, returning the same meeting content twice with slightly different scores.

---

## Findings

### Finding 1 — Conflicted vault copies are indexed as real notes (P1)

**Area:** search  
**Severity:** P1  
**Evidence:** `mcp-servers/cortex-vault/lib/indexer.js:36` — `e.isFile() && e.name.endsWith('.md')` with no filter for iCloud/Dropbox conflict-copy filename patterns. `isExcludedPath()` (line 12-19) only filters hidden files/dirs and four hardcoded directory names. A file named `2026-05-31 FKT Standup (Ben's MacBook Air's conflicted copy).md` or `memory (iCloud conflict 2026-06-01).md` ends in `.md`, lives in a non-excluded directory, and is indexed as a live note.  
**Impact:** Every `recall_related` query for FKT work surfaces duplicate meeting content — the real note and its conflict copy. Both have similar embeddings so both clear the 0.5 score threshold. The user gets "Worth knowing: [[2026-05-31 FKT Standup]] · [[2026-05-31 FKT Standup (Ben's MacBook Air's conflicted copy)]]" with no indication that one is garbage. Over time, unresolved conflict copies accumulate and increase semantic noise across all queries.  
**Suggested fix:** Extend `isExcludedPath()` to reject filenames containing known conflict-copy patterns: `/ \(.*conflicted copy.*\)\.md$/i`, `/ \(.*iCloud conflict.*\)\.md$/i`, `/ \(.*Dropbox conflict.*\)\.md$/i`. Add a single regex test at the file-name level in `walk()`, independent of directory filtering.

---

### Finding 2 — search.db lives inside the iCloud-synced vault; no cross-device locking (P1)

**Area:** perf  
**Severity:** P1  
**Evidence:** `mcp-servers/cortex-vault/lib/search-db.js:11` — `const dbPath = path.join(cortexDir, 'search.db')` where `cortexDir = path.join(vaultPath, '.cortex')`. The vault is `~/Documents/The Vault`, which is an iCloud Drive folder. The WAL pragma (line 19: `db.pragma('journal_mode = WAL')`) and 5-second busy_timeout (line 20) protect against concurrent writers on the *same machine*. They do not protect against iCloud syncing `search.db-wal` and `search.db-shm` between two machines that are both open. iCloud does not expose POSIX file locks across devices; concurrent writes can corrupt the database. There is no `.nosync` marker, no `.icloudignore`, and no documentation warning about this.  
**Impact:** On a two-machine day with both Claude Desktop instances active, the second device to open `search.db` (or the background reindex spawned by `post-tool-use`) may encounter `SQLITE_CORRUPT` or `SQLITE_BUSY` timeouts. Errors are silently swallowed in `recall_related`'s `try/finally` (line 94), so the user never knows — ambient recall simply stops working without explanation.  
**Suggested fix:** Move `search.db` out of the vault to a machine-local path (e.g. `~/.claude/cortex/search-<vault-id>.db`). This removes the file from iCloud/Dropbox sync entirely. Alternatively, add a Dropbox `.nosync` sentinel (rename to `search.db.nosync` and update the path logic) and document the iCloud limitation prominently in setup docs.

---

### Finding 3 — Transcript auto-routing misses Fathom/Granola speaker label formats (P1)

**Area:** capture  
**Severity:** P1  
**Evidence:** `hooks/user-prompt-submit:63` — `grep -cE '^[A-Za-z]+: '` is the speaker-detection regex for the structural transcript trigger. This matches only `SingleWord: text` at the start of a line. Fathom exports use `**Speaker Name:**` (Markdown bold) or `First Last:` (multi-word names). Granola exports use `**First Last:**`. Neither matches `^[A-Za-z]+: `. The `trigger-phrases.md` row 12 spec says the structural trigger fires on `"Speaker: text" format, or a Granola/Fathom/Gong export` but the hook implements only the simplest possible single-word-name variant. Manual testing: `echo "**Ashley:** Hello" | grep -cE '^[A-Za-z]+: '` returns 0; `echo "Ben Hungerford: Hello" | grep -cE '^[A-Za-z]+: '` returns 0.  
**Impact:** When this persona pastes a Fathom or Granola export (the primary meeting workflow), the `cortex-process-meeting` hint is not injected. The model may still recognize the meeting format visually, but the deterministic routing layer produces no hint. In practice the transcript gets processed, but without the skill hint the model is more likely to answer inline rather than route to the full `cortex-process-meeting` workflow (with threading, MOC update, hub handoff). All the extraction steps that depend on the skill being explicitly invoked are at risk of being skipped.  
**Suggested fix:** Broaden the speaker-label regex to cover multi-word names and Markdown bold: `grep -cE '^(\*\*)?[A-Za-z][A-Za-z ]+(\*\*)?:[ \t]'`. Also add a pattern check for Fathom's timestamp prefix format `[00:00] Name:`.

---

### Finding 4 — Stop hook appends to memory.md non-atomically; iCloud collision causes duplicate pending-memory flush (P1)

**Area:** capture  
**Severity:** P1  
**Evidence (non-atomic write):** `hooks/stop:167` — `f.write('\n' + content + '\n')` inside an `open(memory_file, 'a')` context. This is not atomic. If iCloud is syncing `memory.md` at the moment the stop hook runs (desktop updated memory 20 minutes ago; laptop is flushing now), iCloud can generate a conflict copy ending in `.md` that then gets indexed as a real note (see Finding 1).  
**Evidence (duplicate flush):** `hooks/stop:101` — the pending-memory check reads `$PLUGIN_DATA/session-cache/pending-memory.json`. This path is not namespaced per-session. If a session crashes before the stop hook runs (force-quit, crash), `pending-memory.json` survives. The next session inherits it. At the end of the next session the stop hook flushes it again, appending memory entries that may have already been written by a prior successful flush on the other machine.  
**Impact:** `memory.md` can accumulate duplicate memory facts. On a multi-device day where both machines had active sessions and one crashed, the surviving machine's next stop hook may double-write the same memory entries.  
**Suggested fix:** (1) Use an atomic write for memory.md: write to a `.tmp` file and `os.replace()` — matching the pattern already used in `file-ops.js:writeFile`. (2) Namespace `pending-memory.json` per session-ID (if the hook receives one) or timestamp it so it is clearly associated with a specific session. Clear it at session-start, not only at session-stop.

---

### Finding 5 — L3 session block hub data is a boot-time snapshot, not per-turn; spec says otherwise (P2)

**Area:** status  
**Severity:** P2  
**Evidence:** `references/activation-levels.md:46` — "Reads the project hub on every turn (not cached — the user is actively making decisions and we don't want stale state)." In practice, `hooks/lib/boot-context.py:420-426` reads the hub exactly once via `parse_hub()` at session-start and injects the result into the `<cortex-session>` block. The `user-prompt-submit` hook (lines 1-210) does not re-read the hub. The `post-tool-use` hook triggers after vault writes but does not re-inject hub state. `cortex-boot/SKILL.md:12` explicitly says "Makes zero file reads — all vault context is pre-loaded by the hook."  
**Impact:** On a multi-device day, the blocker count in the L3 opening line reflects the hub state at session-start on *this* machine. If the other machine resolved a blocker during a morning session, the afternoon session on this machine still shows the stale blocker count until the user explicitly runs `cortex-check-status`. The spec contract ("not cached") creates an expectation the implementation cannot fulfill, which erodes trust when the user notices the discrepancy.  
**Suggested fix:** Either (a) update `activation-levels.md` to say "hub is read at session-start; call `cortex-check-status` for a fresh read mid-session" to match reality, or (b) add a lightweight `user-prompt-submit` check that re-reads the hub's `updated:` mtime and flags if it changed since boot — without injecting the full hub again, just a one-line staleness warning.

---

### Finding 6 — Session-cache files are not per-session; two simultaneous Claude Desktop windows share state (P2)

**Area:** boot  
**Severity:** P2  
**Evidence:** `hooks/session-start:40-45` — `CACHE_DIR="$PLUGIN_DATA/session-cache"` with a single `vault-path.txt`. `hooks/stop:101` — `PENDING_FILE="$PLUGIN_DATA/session-cache/pending-memory.json"` is a flat, single-file path with no session ID. `hooks/post-tool-use:166` — `COACH_FLAG="$PLUGIN_DATA/session-cache/coach-active.flag"` is similarly un-namespaced. The session-cache directory at `~/.claude/cortex/plugin-data/session-cache/` has no per-session subdirectories.  
**Impact:** If the user opens two Claude Desktop windows simultaneously on the same machine (common when switching between an FKT project window and a general-purpose Cortex window), both sessions share `pending-memory.json`. Session A's pending memory writes get flushed by Session B's stop hook when Session B closes first. Session A's stop hook then finds an empty `pending-memory.json` and flushes nothing. Memory entries from Session A are silently lost.  
**Suggested fix:** Namespace all session-cache files by a session ID. Claude Code's hook input JSON includes a `session_id` field (or equivalent) that can be used as the subdirectory name. Each session writes to `session-cache/<session-id>/pending-memory.json` and the stop hook cleans up its own subdirectory on completion.

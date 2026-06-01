# Avatar 27 — Daily-Use Audit
**Date:** 2026-06-01
**Persona:** Team lead sharing one vault with 3 colleagues; multi-author changelog + concurrent edits
**Surface:** Claude Code CLI
**Auditor:** Stress-test subagent

---

## Persona Description

Ben is a team lead for a small agency (The Brand Leader). Three colleagues — Ashley, Jordan, and Sam — share the same Obsidian vault (synced via iCloud or Obsidian Sync). All four have Claude Code + Cortex installed and configured to the same vault path. On any given day, two or more of them may be in active Claude Code sessions simultaneously. All four run `append_changelog`, `open_question`, and write-side tools against the same `_changelog.txt`, `registry.json`, and project hub files.

Ben's day: morning stand-up in Granola, afternoon dev work in the Shopify checkout repo (registered at L3), one sync call mid-day, and end-of-day review of what the team captured.

---

## Simulated Day-in-the-Life

**08:45 — Session start in the FKT checkout repo**

Ben opens Claude Code in `~/Documents/Freelance Projects/fkt-checkout/`. The session-start hook fires, `boot-context.py` walks cwd upward, matches the registered repo, reads the hub, and injects an L3 `<cortex-session>` block. `cortex-boot` opens: "FKT — Shopify Website Build. Current stage: Integrations. 2 open blockers..." Normal so far.

*Meanwhile*, Ashley opened her own Claude Code session 10 minutes earlier and her `cortex-update-context` invocation is mid-flight writing to the same hub file. Ben's boot reads the hub at the moment Ashley's `writeFile()` has already swapped the `.tmp` file but before `fs.renameSync` completes. Ben sees a stale or partial hub state.

**09:15 — Team standup processed**

Ben pastes the Granola transcript. `user-prompt-submit` detects 20+ lines and 3+ speaker labels, routes to `cortex-process-meeting`. The skill creates the note under `Work/TBL/FKT/Shopify Website Build/Notes/`, calls `thread_meeting` (which reads all `.md` files in that Notes dir), calls `update_moc`, calls `append_changelog`. These are three sequential `writeFile`/`appendFile` calls against files that Ashley's session may also be touching.

**10:30 — Ben resolves a blocker**

"That's resolved — we got the Stripe sandbox creds." `user-prompt-submit` matches "that's resolved", routes to `cortex-update-context`. The skill reads the hub, removes the blocker row, writes the hub back, appends to `Changelog.md`, appends to `_changelog.txt`. If Ashley wrote to the hub between Ben's read and Ben's write, Ashley's change is silently overwritten.

**12:00 — Status check**

"What's the status of FKT?" Routes to `cortex-check-status`, calls `read_hub`. Correct file is read. If the hub was last written 8 minutes ago by Jordan's session, Ben sees fresh data. No issue here since it is read-only.

**14:00 — Ben's session ends**

The stop hook fires. `pending-memory.json` is flushed to `memory.md` using `open()` with mode `'a'` — a simple append. If another session wrote to `memory.md` between boot and stop, the appended entries may duplicate facts already added by that other session.

**17:00 — End of day: Ben checks recent activity**

Ben asks "what happened on FKT today?" `cortex-check-status` reads `_changelog.txt` tail via the boot-loaded `recent_activity`. But since `read_changelog` in `boot-context.py` only tails 15 lines, and four agents wrote to the changelog all day, Ben sees only the last 15 entries — most of today's activity is invisible.

---

## Findings

### Finding 1 — P0: `writeFile` via rename is not concurrent-safe across processes

**Area:** capture

**Evidence:** `mcp-servers/cortex-vault/lib/file-ops.js:16-18`

```js
const tmpPath = filePath + '.tmp.' + crypto.randomBytes(4).toString('hex');
fs.writeFileSync(tmpPath, content, 'utf8');
fs.renameSync(tmpPath, filePath);
```

`writeFile` does an atomic rename on a single process, but it is not protected by any cross-process lock. When two agents (Ben's session and Ashley's session) both read the same hub file, then both independently build `updatedContent` and call `writeFile`, the second rename silently wins — the first agent's write is lost entirely. With 4 colleagues sharing one vault, this is the most common daily operation pattern (blocker resolutions, decision captures, MOC updates) and every overlapping session is a silent data-loss risk.

**Impact:** One agent's captured decision, blocker removal, or MOC entry disappears with no error or warning. The vault shows incorrect state and neither user knows it happened.

**Suggested fix:** Introduce a per-file advisory lock (e.g. a `.lock` file with `O_EXCL` or Node's `lockfile`/`proper-lockfile` package). Alternatively, implement optimistic concurrency: hash the file at read time; before writing, re-read and compare hashes — if changed, surface a conflict rather than overwriting. At minimum, document the race prominently and gate the multi-author persona with a warning.

---

### Finding 2 — P0: `_changelog.txt` is append-only but `appendFile` races across 4 concurrent sessions

**Area:** capture

**Evidence:** `mcp-servers/cortex-vault/lib/file-ops.js:21-25`

```js
function appendFile(filePath, line) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const suffix = line.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(filePath, line + suffix, 'utf8');
}
```

`fs.appendFileSync` appends atomically at the OS level on macOS (due to `O_APPEND`), so individual entries will not be interleaved mid-line. However, the `hooks/stop` hook at line 181 bypasses `appendFile` entirely and uses a raw `echo "$ENTRY" >> "$CHANGELOG_FILE"` shell redirect, which does NOT carry the same atomic guarantee under Bash's buffered write path. Multiple agents flushing memory updates simultaneously via the stop hook can interleave or drop entries.

**Impact:** Changelog audit trail — the single source of truth for "what the team did today" — becomes corrupt or loses entries, exactly when a team lead needs it most (end-of-day review).

**Suggested fix:** Route the stop hook through the same Node CLI (`append-changelog-cli.js`) that the post-tool-use hook already uses (see `hooks/post-tool-use:186`). The stop hook's raw shell echo at line 181 should be replaced with the same conditional `node "$APPEND_CLI"` + fallback pattern already established in post-tool-use.

---

### Finding 3 — P1: `boot-context.py` tails only 15 changelog lines; with 4 active authors, today's activity overflows

**Area:** boot

**Evidence:** `hooks/lib/boot-context.py:72-83`

```python
def read_changelog(vault_path, tail=15):
    ...
    return "".join(all_lines[-tail:]).rstrip("\n"), total
```

The tail is hardcoded at 15 lines. Four colleagues each firing 3-5 changelog writes per session (decisions, blocker resolutions, MOC updates, meeting notes) easily produces 20+ entries per day. The boot session block therefore shows only the most recent 15 lines, cutting off morning activity by afternoon. The `total_lines` count reaches the `check_dormant_features` threshold correctly, but the `recent_activity` presented to the model is incomplete.

**Impact:** The team lead's morning L3 boot misses activity from the overnight or prior afternoon. Status checks citing `recent_activity` give an artificially narrow window, and the Conflict Rule in `cortex-update-context` relies partly on the session's understanding of recent history.

**Suggested fix:** Make `--tail` configurable per team size. A reasonable multi-author default is 40-60 lines. Alternatively, filter to today's date prefix so the window is time-bounded rather than count-bounded: `[lines for l in lines if l.startswith(f'[{today}')][-tail:]`.

---

### Finding 4 — P1: `open_question` tool uses strikethrough-resolve instead of row-removal; contradicts `cortex-update-context` skill contract

**Area:** capture

**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js:77`

```js
lines[matchIdx] = `- [x] ${originalText} — Resolved: ${resolution}`;
```

The tool marks the question as `[x]` (checked) with an inline "Resolved:" suffix. But `cortex-update-context` SKILL.md:97 explicitly states:

> "Remove the row from the Hub's Open Questions table entirely. Do not use strikethrough. Do not mark it 'resolved' in-place."

When `cortex-update-context` calls `open_question` via MCP to resolve a blocker, the MCP tool leaves a `[x]` residue. Over days of multi-author activity, the Open Questions section accumulates checked-off stale rows. The team lead's status check will show these checked items as visual clutter, and the boot-context parser at line 219 (`if not question or status.lower() == "resolved":`) is designed to skip rows where `status == "resolved"`, but it is parsing a *table* format, not a `- [x]` checklist format — so the inconsistency means checked items may still be counted as active blockers if the hub uses a checklist format.

**Impact:** Repeated multi-author blocker resolutions degrade hub quality daily. Status checks become noisy. The "blocker count" in the L3 boot greeting may be over-reported.

**Suggested fix:** Change `open_question` action `resolve` to remove the line entirely (matching the skill's stated contract) and append the resolution text to the `Changelog.md` section only. If leaving a trace in the hub is desired, add a separate `## Recently Resolved` section that the boot parser already knows to ignore.

---

### Finding 5 — P1: `vault-path.js` caches vault path in process memory with no TTL; stale cache persists if vault is moved mid-day

**Area:** mcp

**Evidence:** `mcp-servers/cortex-vault/lib/vault-path.js:3-5`

```js
let cached = undefined; // undefined = not yet read, null = read but invalid
```

The MCP server process is long-lived (it runs for the entire Claude Code session). `getVaultPath()` reads `config.json` once and caches the result for the process lifetime. If a team member updates `config.json` (e.g. vault re-path after sync conflict resolution, or during Cortex upgrade), the running MCP server will continue using the stale path until restarted. All subsequent tool calls silently read/write to the old path or fail silently if the old path no longer exists.

**Impact:** For a multi-author team that occasionally adjusts vault paths or reinstalls, an agent can write meeting notes, MOC entries, and changelog entries to the wrong location with no error surfaced to the user.

**Suggested fix:** Add a TTL to the cache (e.g. `stat()` config.json mtime; re-read if mtime changed since last cache). Alternatively, expose a `clearCache` path via a dedicated MCP tool or on each tool invocation check mtime. The `clearCache` export already exists at line 73 but is only used in tests — expose it as a lightweight refresh path.

---

### Finding 6 — P2: `thread_meeting` requires >= 3 notes in a series before linking; the 2nd meeting in any series gets no `*Previous:*` link

**Area:** meeting

**Evidence:** `mcp-servers/cortex-vault/tools/thread-meeting.js:194-199`

```js
if (effectiveGroup.length < 3) {
  return {
    content: [{
      type: 'text',
      text: `Series "${newParsed.title}" has ${effectiveGroup.length} note(s) — need at least 3 to thread. Skipping.`
    }]
  };
}
```

The guard requires 3+ notes before threading, meaning the 2nd meeting note in a recurring series (which is when thread links would first be valuable — linking back to the inaugural meeting) never gets a `*Previous:*` link. With 4 colleagues generating meeting notes across multiple recurring series (weekly standups, biweekly client check-ins), the first link is always missing.

The `cortex-process-meeting` SKILL.md:73 states threading fires when a group has "2+ prior entries", which aligns with the 3-note minimum (new note = 3rd), but this means the 2nd meeting note, which the team would naturally navigate from, is an orphan in the chain.

**Impact:** For a team processing 5+ recurring meeting series, any meeting that is the 2nd in its series lacks navigation context. A colleague picking up a meeting thread sees no link to the previous call. Not data-loss, but meaningfully degrades the navigation UX that threading is designed to provide — and the team lead is the one who most often needs to audit the chain.

**Suggested fix:** Lower the threshold to 2. Thread when `effectiveGroup.length >= 2` (i.e. new note is 2nd or later). The "need 3 to thread" restriction appears to guard against noise from accidentally same-titled one-offs, but the date-prefix format already provides sufficient series fidelity without needing the 3-count buffer.

---

## Summary

The most critical findings for this persona are the two data-integrity races (F1, F2) that become daily realities with 4 concurrent agents sharing one vault. They are not edge cases — any two colleagues resolving blockers or capturing decisions within the same few-second window triggers a silent overwrite. The changelog audit trail corruption (F2) is particularly damaging because it is exactly what the team lead relies on for end-of-day review and onboarding catch-up. The remaining findings (F3–F6) represent steady compounding friction in a multi-author environment that becomes more visible as team velocity increases.

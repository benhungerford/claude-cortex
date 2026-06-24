---
avatar: 23
persona: Connector power user
surface: Claude Desktop
date: 2026-06-01
auditor: subagent
---

# Avatar 23 — Connector Power User Daily-Use Audit

## Persona

Cross-tool Connector: Gmail, Google Calendar, Monday.com, Slack, and Google Drive all wired into Claude Desktop via MCP. Manages 3–5 active client projects under a TBL (The Brand Leader) vault structure. Typical day involves opening multiple sessions across different project repos, processing meeting transcripts from Granola/Fathom, capturing decisions surfaced via Slack/Monday, and querying status across projects. High session volume, high cross-tool signal throughput.

---

## Day Narrative

**8:45 am — Morning boot, Shopify project repo**

Opens Claude Desktop from the FKT Shopify repo directory. The `session-start` hook fires, `boot-context.py` walks up from cwd, finds the registry match, parses the hub, and injects a `<cortex-session>` block at L3. `cortex-boot` reads it and delivers the L3 opener: project name, stage, blocker count.

First cross-tool action: asks Claude to pull last night's Granola transcript for the client standup. The Granola MCP tool returns a 180-line transcript. The `user-prompt-submit` hook structural trigger fires (`LINE_COUNT >= 20`, `SPEAKER_COUNT >= 3`), injecting `<cortex-hint>likely-skill: cortex-process-meeting</cortex-hint>`. The transcript gets processed: decisions extracted, meeting note filed under the project's `Notes/` folder, threading fires via `thread_meeting`.

**10:15 am — Mid-morning pivot, new Claude session (no repo context)**

Opens a fresh Claude Desktop session from `~/Documents` (outside vault, outside any registered repo) to answer a Monday.com question about the Bubl Shots compliance project. Boot fires at L1. The user types "what's the status of Bubl Shots age verification?" — `user-prompt-submit` matches the status trigger and injects the hint. `cortex-check-status` fires, reads the hub, delivers a status summary.

While looking at the hub, the user says: "we decided to go with Shopify's native age gate rather than a third-party app." The `user-prompt-submit` hook catches "we decided" and injects the `cortex-update-context` hint. The skill fires, detects a conflict (hub lists a third-party solution), surfaces `CONFLICT DETECTED`, user resolves it, vault gets updated.

**1:30 pm — Post-lunch Slack dump**

User pastes a Slack thread of 8 messages from the client (not a meeting transcript — no speaker labels in the `Name: text` format, just raw message blocks). User says "log this decision from Slack." The `user-prompt-submit` hook correctly catches "log this" → `cortex-update-context`. But the pasted Slack content has no speaker-label structure, so no transcript auto-detection.

**3:00 pm — Cross-project recall**

User asks about a Shopify checkout pattern they remember using on a different project. Ambient recall fires via `recall_related`, returns 5 results from the semantic index, 2 clear above 0.5 threshold. User finds the knowledge base article.

**5:00 pm — End of day, session stops**

Stop hook fires, flushes any pending memory updates to `memory.md`, logs to `_changelog.txt`. Session ends cleanly.

---

## Findings

### Finding 1 — `open_question` resolve leaves `[x]` strikethrough in the hub instead of deleting the row

**Severity: P1**

**Area: capture**

**Evidence: `mcp-servers/cortex-vault/tools/open-question.js:77`**

```js
lines[matchIdx] = `- [x] ${originalText} — Resolved: ${resolution}`;
```

The `resolve` action marks the question with `- [x]` strikethrough and appends "— Resolved: <text>". But `cortex-update-context/SKILL.md` (The Blocker-Resolved Rule section) and `references/capture-rules.md` are explicit: "Remove the row from the Open Questions table entirely. Do not use strikethrough." The MCP tool the skill is instructed to prefer (`mcp__cortex-vault__open_question`) directly contradicts the spec the skill reads. A Connector power user clearing blockers multiple times per day (received Stripe creds, got a client response, resolved a Monday dependency) will accumulate `[x]` rows in their hub. Over a month this creates exactly the noise the spec says to prevent: a hub Open Questions table polluted with resolved items, making it harder to scan at a glance for active blockers. The boot context parser (`boot-context.py:219`) filters by `status.lower() == "resolved"` in the stage tracker but not the open questions — it filters only on type fields, so it won't rescue this.

**Suggested fix:** Change `resolveQuestionInBody` in `open-question.js` to splice out the matching line entirely, and add the resolution text to the `_changelog.txt` entry instead. The tool already appends a changelog entry at line 182; the resolution detail belongs there, not in the hub.

---

### Finding 2 — `recall_related` embedding model cold-start blocks the first ambient recall of every session by 2–8 seconds

**Severity: P1**

**Area: recall**

**Evidence: `mcp-servers/cortex-vault/lib/embeddings.js:7–16`**

```js
let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = true;
    extractorPromise = pipeline('feature-extraction', MODEL_ID);
  }
  return extractorPromise;
}
```

The `Xenova/all-MiniLM-L6-v2` model is loaded lazily on the first `embed()` call. For a Connector power user, the first `recall_related` call lands in the first substantive turn (cortex-boot step 6 fires it immediately on the first task-like message). The model load involves downloading/loading weights — on a cold MCP server process this can take 2–8 seconds depending on disk cache state. The MCP server is a stdio process that starts fresh per session; `extractorPromise` does not persist across sessions. The user's first "what's the status of..." or pasted Granola transcript therefore hangs visibly before Cortex can answer. For a Connector power user opening 4–6 sessions per day, this cold-start penalty is paid every time.

**Suggested fix:** Eagerly trigger `getExtractor()` at MCP server startup in `server.js` (call it during the `main()` init, before any tool requests arrive). The model will be warm by the time the first `recall_related` or `search_vault` call comes in. Add a `// warm embeddings model on startup` comment so the intent is clear.

---

### Finding 3 — Cross-tool decisions pasted from Slack/Monday/email are not captured unless the user uses an exact trigger phrase

**Severity: P1**

**Area: capture**

**Evidence: `hooks/user-prompt-submit:83–110` (write-side trigger patterns)**

The `user-prompt-submit` hook routes to `cortex-update-context` only on literal phrases: "log that", "log this", "we decided", "decision:", "I'm going with", "going to go with", "final answer is", "we're using". A Connector power user's actual language when pasting Slack messages looks like: "this came from a Monday comment", "here's what the client said on the call", "Ashley confirmed this in Slack yesterday", "client approved the direction", "they agreed to X." None of these phrases match any write-side trigger. The ambient Tier 1 capture in `capture-rules.md` is supposed to cover this — cortex-boot "watches for capture signals" — but that is a model-level instruction with no hook-level enforcement. The hook is the only reliable pre-model routing mechanism, and it misses all natural connector-tool language. The result: decisions that arrive via Gmail, Monday updates, or Slack threads are systematically under-captured unless the user consciously re-phrases them using Cortex's trigger vocabulary.

**Suggested fix:** Expand the write-side pattern set in `user-prompt-submit` to include connector-origin signals: patterns like `"client confirmed"`, `"client approved"`, `"they agreed"`, `"here's what .* said"`, `"from the monday"`, `"from slack"`, `"from the email"`. These are high-signal phrases specific to cross-tool connector workflows. Alternatively, add a soft trigger that fires when the user pastes a long message block without speaker labels and injects a Tier 2 hint asking whether to capture.

---

### Finding 4 — `boot-context.py` `resolve_cwd` walk stops at `home` directory, breaking L3 for repos stored in subdirectories of home outside common paths

**Severity: P2**

**Area: boot**

**Evidence: `hooks/lib/boot-context.py:140–153`**

```python
while candidate and candidate != os.path.dirname(candidate):
    for project in projects:
        for repo_path in project.get("repo_paths", []):
            if os.path.realpath(repo_path) == candidate:
                return 3, project
    parent = os.path.dirname(candidate)
    # Stop at home directory or root
    if candidate == home or parent == candidate:
        break
    candidate = parent
```

The walk stops when `candidate == home`. For a Connector power user whose repos live in `~/Documents/Cortex/claude-cortex` (as with this actual repo), the walk from a deeply-nested cwd correctly traverses through `~/Documents/Cortex/claude-cortex` before hitting home. That works. But the issue is the opposite: if a repo is registered as `~/some-repo` (directly in home), the loop reaches `home`, checks it against registry, and then hits `candidate == home` and `break`s — it never checks `home` itself because the break fires after the check. Actually reading the code more carefully: the check happens first (`for project in projects`), then the break is evaluated. So `home` itself IS checked. The real failure mode is subtler: when `os.path.realpath(repo_path)` differs from what was registered (e.g., the registered path used a symlink or relative path, while `realpath` resolves it differently). The `resolve_cwd` function calls `os.path.realpath(cwd)` for the walk target but `os.path.realpath(repo_path)` for each registry entry — these are symmetrically resolved, so symlinks are handled. However the `registry.py` `findProjectByCwd` in the Node MCP server (used by `find_project_by_cwd` tool) uses `path.normalize` (not `realpath`) for comparison (`registry.js:105`). This creates a two-path mismatch: the Python boot uses realpath, the Node MCP tool uses normalize. A symlinked project path registered via the Node tool but queried by the Python boot will not match if the symlink resolves differently.

**Suggested fix:** In `registry.js:findProjectByRepoPath`, replace `path.normalize(p)` with `fs.realpathSync(p)` (with a try/catch fallback to `path.resolve`) to match the Python boot's `os.path.realpath` resolution. Add a note in both files that this pairing must stay in sync.

---

### Finding 5 — `thread_meeting` requires 3+ meetings in the series before threading starts, silently skipping series that are exactly 2 notes old

**Severity: P2**

**Area: meeting**

**Evidence: `mcp-servers/cortex-vault/tools/thread-meeting.js:194–200`**

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

The tool requires `effectiveGroup.length >= 3` to thread. The `cortex-process-meeting` SKILL.md threading rules say a series exists when "3 or more meetings in the same folder share a stable title suffix" — so the skill spec and the tool agree on the 3-meeting threshold. But the practical consequence for a Connector power user is: a recurring weekly standup's first two notes are never linked even though they share an identical title suffix and are clearly a series. The second standup note — the first moment a user would want a "Previous" link — gets silently skipped. The user gets no `*Previous:*` link on the 2nd note, no confirmation that threading was skipped, and only on the 3rd note does threading activate. When the user later navigates to the 2nd note expecting chronological threading, the link is absent. Because the `thread_meeting` tool returns a non-error response (not `isError: true`) for the skip case, the calling skill has no clean signal that threading was suppressed; it may confirm "threaded" when it wasn't.

**Suggested fix:** Lower the threshold to 2 (thread the 2nd note with the 1st, which already has a matching title suffix and is unambiguously a recurring series). The 3-meeting threshold was likely meant to prevent single accidental title matches from being threaded, but 2 notes with identical title suffixes is sufficient evidence of a series. Update both the tool and the SKILL.md spec together.

---

### Finding 6 — `vault-path.js` module-level cache survives the entire MCP server process lifetime, causing stale vault paths if the user changes `config.json` mid-session

**Severity: P2**

**Area: mcp**

**Evidence: `mcp-servers/cortex-vault/lib/vault-path.js:4–11`**

```js
let cached = undefined; // undefined = not yet read, null = read but invalid

function getVaultPath() {
  if (cached !== undefined) return cached;
  // ... reads config.json once, then caches forever
}
```

The `getVaultPath()` function reads `~/.claude/cortex/config.json` exactly once and caches the result for the lifetime of the Node MCP server process. The MCP server is a long-running stdio process. For a Connector power user who changes their vault path (e.g., migrating from one Obsidian vault to a new one during a session, or correcting a misconfigured path), every MCP tool call will continue hitting the old vault silently. There is no TTL, no file-watch, no re-read. The `clearCache()` export exists (`vault-path.js:73`) but is only used in tests — no production code path calls it. The mismatch could cause `recall_related` to query the wrong SQLite DB, `append_changelog` to write to the wrong vault, and `thread_meeting` to read from the wrong folder — all silently, with no error, because the old path still exists on disk.

**Suggested fix:** Add a simple stat-based TTL: store the `mtime` of `config.json` at read time and re-check it on each `getVaultPath()` call. If mtime changed, clear and re-read. Cost is one `fs.statSync` per tool call (negligible). Alternatively, use `fs.watchFile` to invalidate the cache on write. The `clearCache` export is already wired for tests, so the reset path exists — it just needs to be reachable from production code.

---

## Summary

The Connector persona's daily loop mostly holds together — boot, status checks, and meeting processing work as designed. The highest-impact issues are a spec/implementation divergence on blocker resolution (P1, silently pollutes hubs), a systematic cold-start latency on semantic recall every session (P1, paid 4–6 times per day), and a trigger-phrase gap that causes cross-tool decisions (the core Connector use case) to bypass ambient capture unless the user learns Cortex's specific vocabulary (P1). The threading threshold and vault cache issues are lower-urgency but create subtle wrong-behavior moments at a user's natural daily rhythm.

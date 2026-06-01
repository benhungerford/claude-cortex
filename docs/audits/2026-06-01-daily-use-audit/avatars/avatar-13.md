---
created: 2026-06-01
avatar: 13
persona: Content creator / writer capturing fleeting ideas all day
surface: Claude Desktop
auditor: claude-sonnet-4-6
---

# Avatar 13 — Daily-Use Audit
**Persona:** Content creator / writer who captures fleeting ideas all day and fears losing half-formed thoughts  
**Surface:** Claude Desktop  
**Date:** 2026-06-01

---

## Persona Profile

This user is a freelance content creator and writer. They maintain an Obsidian vault that holds multiple client writing projects, a Knowledge Base of craft techniques and sources, and a _Inbox for capturing raw ideas as they surface throughout the day. Their primary fear: something half-baked said mid-session gets lost because it was "not a decision" and Cortex's capture rules quietly skipped it.

They open Claude Desktop 6–8 times a day from different starting directories — sometimes their desktop, sometimes a client project folder, sometimes directly inside the vault. Sessions are short and purpose-driven. They dictate or type ideas informally ("that voice-of-customer angle we talked about for the Bubl campaign — keep that") and expect the system to decide whether to log it or ask. They process Granola meeting notes after calls. They ask recall questions while mid-draft ("have I written about this pattern before?"). They almost never say the trigger phrases exactly right.

---

## Simulated Day in the Life

**8:00 AM — Morning cold open, desktop context**  
User opens Claude Desktop from `~/Desktop`. cwd is nowhere near the vault or any registered repo. `boot-context.py` resolves L1. The session block injects their personality, memory, and inbox count. Boot fires the `cortex-boot` skill silently. No output. Inbox shows 3 items. Per L1 contract, nothing surfaces. Good so far.

They immediately say: "remind me what I was doing with the Bubl Shots compliance piece" — no trigger phrase. Cortex needs to fuzzy-match "Bubl Shots" from personality buckets, escalate to L2, and recall context. It will attempt `recall_related` with that context string. **The user gets help if the embedding hits and if the vault is indexed.** If the index is stale or empty, they get nothing from recall, only whatever is in the L1 session block.

**9:30 AM — Mid-morning capture, streaming idea**  
User is writing an article draft. A phrasing idea strikes: "I want to remember — the 'permission structure' framing I'm using for age verification articles is probably reusable across compliance writing." They say it informally.

The `user-prompt-submit` hook scans for `"reusable"`, `"worth remembering"`. The word "reusable" appears. It fires a `cortex-knowledge` hint. Cortex picks it up and asks whether to extract it. User confirms. The knowledge article is created. The `post-tool-use` hook fires on the Write, logs to `_changelog.txt`, then calls `reindex-one.js` in the background to re-embed the new file. **This is the happy path.** But: the embed call loads `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers`. If the model isn't already warm in the MCP server process, the first embed of the session can take 5–15 seconds while the model initialises — silently, from the user's perspective.

**11:00 AM — Meeting notes from client call**  
User pastes a Granola export (35 lines, multiple speaker labels). The `user-prompt-submit` hook detects `LINE_COUNT >= 20` and `SPEAKER_COUNT >= 3` and fires a `cortex-process-meeting` hint. Cortex processes the meeting, creates the note, threads it if a series exists, extracts decisions.

The user's informal summary included: "Ashley said she's fine with the voice being casual — keep that." This is a client preference signal. Per `capture-rules.md` Tier 1, client preferences should be captured silently. But the skill hands off to `cortex-update-context` which must locate the correct project hub. If the transcript didn't explicitly name a project, Cortex asks. **For a writer with 5+ active writing projects, these disambiguation asks accumulate.**

**1:30 PM — Recall while drafting**  
The user asks: "have I written anything before about balancing brand voice with regulatory language?" — no project name, no trigger phrase, just a question. `user-prompt-submit` finds no matching skill hint and emits `{}`. The cortex-boot ambient recall fires (per `SKILL.md` Step 6), calling `recall_related` with the user's question as context. Results filter at `score > 0.5`. If the query hits, a one-line note surfaces: "Worth knowing: you've documented this in [[Age Verification Compliance Notes]]."

**3:00 PM — Quick capture before a call**  
In a hurry, the user says: "log that we're pivoting the Bubl piece to a listicle format." The `user-prompt-submit` hook catches `"log that"` and fires `cortex-update-context` with high confidence. Good. But the session is L1 (desktop context). `cortex-update-context` has to resolve which project "the Bubl piece" refers to. The skill's failure mode table says: "Project unclear from context — ask once." It asks. The user is annoyed at being interrupted before their call.

**5:00 PM — Session close**  
The Stop hook fires. It checks `pending-memory.json` for anything the session queued. If there are pending memory updates, they get flushed to `memory.md` and logged to `_changelog.txt`. The user never sees this happen.

---

## Findings

### Finding 1 — Exploratory / half-formed thoughts classified as Tier 3 and silently dropped (P1)

**Area:** capture  
**Evidence:** `references/capture-rules.md` lines 58–65:

> Tier 3 — Never capture: Brainstorming that hasn't led to a decision … General conversation unrelated to work

A content creator's core workflow is iterative idea development — they articulate half-baked framings, test out article angles, and refine them over multiple turns. The two-question heuristic ("would the user want to find this in six months?", "do I know exactly where it goes?") is evaluated silently by Cortex, and anything classified as "exploratory information — user is thinking out loud, not deciding" falls into Tier 2 or Tier 3 without any signal to the user.

The Tier 2 path does ask, but only "at the next natural pause" — which for a writer mid-flow may be several turns later, or the session ends first. If the system's confidence is low enough to silently drop rather than ask, the idea is gone with no trace.

**Impact:** The user's core fear is specifically this: a half-formed thought expressed conversationally is evaluated as "not a decision" and discarded. There is no audit trail of what was evaluated and dropped, so the user can't recover it.

**Suggested fix:** Add a "soft capture" mechanism: for Tier 2 candidates that are NOT asked about during the session (because no natural pause arrived before session end), the Stop hook should flush them to `_Inbox/` with a `[pending-review]` tag rather than discarding them. The user reviews the inbox and promotes or deletes. This turns a permanent loss into a deferred decision.

---

### Finding 2 — First-session embed cold-start stalls recall silently (P1)

**Area:** recall  
**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js` lines 7–17:

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

The `Xenova/all-MiniLM-L6-v2` model is loaded lazily on first embed call. On a cold MCP server (first session of the day, or after a process restart), the pipeline initialisation — model file loading + ONNX runtime startup — takes 5–15 seconds. During this time:

1. The `recall_related` call from `cortex-boot` Step 6 is blocking on this load.
2. The user sees a pause before Cortex responds to their first substantive message.
3. There is no user-visible indication that this is happening.

For a writer who fires a quick question first thing in the morning ("what did I decide about the Bubl framing?"), a 10-second unexplained pause before any response reads as a broken tool.

The `post-tool-use` reindex also calls `embed` in the background (`hooks/post-tool-use` line 207: `node "$REINDEX_BIN" ...`), but that runs in a detached background process so its latency is invisible — the problem is the synchronous path through `recall_related` and `search_vault`.

**Impact:** First recall of each MCP server lifecycle stalls the conversation. For a user who opens Claude Desktop multiple times per day and fears missed context, this invisible lag undermines trust in the recall feature.

**Suggested fix:** Pre-warm the embed pipeline at MCP server startup (or at first `recall_related` / `search_vault` call) by initiating the `getExtractor()` promise eagerly in `server.js` after tool registration, rather than waiting for the first tool call. The pipeline initialisation is idempotent; starting it at server boot means the first actual embed call finds it already resolved.

---

### Finding 3 — Transcript trigger requires exact speaker-label format; informal pastes silently skip to L1 (P1)

**Area:** capture  
**Evidence:** `hooks/user-prompt-submit` lines 60–68:

```bash
LINE_COUNT="$(printf '%s' "$USER_PROMPT" | wc -l | tr -d ' ')"
if [[ "$LINE_COUNT" -ge 20 ]]; then
    SPEAKER_COUNT="$(printf '%s' "$USER_PROMPT" | grep -cE '^[A-Za-z]+: ' 2>/dev/null || echo 0)"
    if [[ "$SPEAKER_COUNT" -ge 3 ]]; then
        SKILL="cortex-process-meeting"
```

The structural transcript trigger requires BOTH 20+ lines AND 3+ lines matching `^[A-Za-z]+: `. This pattern matches "Name: text" at line start, which is Granola's format. However:

- Fathom's transcript format uses timestamps: `[00:01:23] Speaker: text` — the `^[A-Za-z]+:` regex fails on `[00:01:23]`.
- A user who pastes their own rough notes ("Ashley said X, I said Y") doesn't have speaker labels.
- A transcript with 2 speakers and 25 lines but only 2 unique speaker turns (e.g. a brief check-in call) fails the `SPEAKER_COUNT >= 3` threshold.
- Zoom auto-transcripts use `Name (HH:MM):\n  text` with an indent — multi-line per turn, so the count may be below threshold.

When the structural trigger misses, `user-prompt-submit` emits `{}` and the transcript is processed as a normal conversational message. If no explicit phrase like "process this meeting" is included, the whole transcript gets answered as a knowledge question rather than filed. The meeting note is never created, the decisions are never extracted to the hub, and the user doesn't know anything was skipped.

**Impact:** A writer who pastes Fathom exports or their own notes loses every meeting filing and decision-extraction step. This is a common real-world format mismatch with no graceful fallback.

**Suggested fix:** Broaden the structural heuristic to also match `[timestamp] Name:` patterns and indented multi-line speaker blocks. Additionally, if `LINE_COUNT >= 20` but speaker labels are absent, emit a lower-confidence hint and let the model decide with context, rather than silently emitting `{}`.

---

### Finding 4 — open_question tool uses checkbox format incompatible with the project context hub's table format (P1)

**Area:** capture  
**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js` lines 32–59 implement `addQuestionToBody` which appends a `- [ ] text` checkbox item to an `## Open Questions` section. But `hooks/lib/boot-context.py` lines 205–224 parse blockers from a markdown table:

```python
oq_section = re.search(
    r'## Open Questions & Blockers\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)',
    content,
)
```

The hub template uses a pipe-delimited table (`| # | Question | Type | Owner | Status |`). The MCP tool writes `- [ ] text` checkboxes. The Python parser reads the table format. These two never meet: items added via `open_question` (add action) go into a checkbox list that `boot-context.py` cannot parse as blockers, so they never appear in the L3 boot block's `Blockers:` or `Open questions:` lines.

A content writer who logs a creative blocker ("blocked by: need Ashley's brand voice brief before I can draft") via the `open_question` MCP tool will see it confirmed in chat, but it will never surface in the morning L3 status opener or in `cortex-check-status` outputs — because both of those read from the table, not the checkbox list.

**Impact:** Silently creates a two-class system of blockers. Items entered via the MCP tool are invisible to boot and status-check reads. For a writer tracking deliverable blockers across projects, this creates the false impression that everything is clear when it isn't.

**Suggested fix:** The `open_question` tool should write into the table format that `boot-context.py` reads. Alternatively, `boot-context.py` should also parse the checkbox `## Open Questions` section as a fallback. The two representations need to converge.

---

### Finding 5 — vault-path.js caches the vault path for the MCP server process lifetime; vault moves or reconfiguration are invisible until server restart (P2)

**Area:** mcp  
**Evidence:** `mcp-servers/cortex-vault/lib/vault-path.js` lines 4–5, 48–71:

```js
let cached = undefined; // undefined = not yet read, null = read but invalid

function getVaultPath() {
  if (cached !== undefined) return cached;
  // ... reads config.json once, caches result
}
```

The `cached` variable is module-level. Once resolved (success or null), `getVaultPath()` never re-reads `config.json`. In Claude Desktop, the MCP server process lives for the entire application session, potentially hours. If the user moves their vault (common in reorganised Obsidian setups) or updates `config.json`, every subsequent `recall_related`, `search_vault`, `append_changelog`, etc. will either use the stale old path (silently writing to the wrong location) or return "Vault path not configured" until the server process is restarted.

For a content creator who reorganises their vault mid-day (e.g. renames a top-level folder while consolidating client work), this is an invisible failure that corrupts the audit trail without any error surfaced to the user.

**Impact:** Silent writes to a stale vault path or complete MCP failure after a vault move, with no user-visible error. Changelog entries go to the old location. Re-embeds index the old path. The user has no indication until they notice the vault isn't updating.

**Suggested fix:** Replace the permanent cache with a TTL-based refresh (e.g. re-read `config.json` if the cache is older than 60 seconds), or stat the config file's mtime on each call and invalidate if it has changed. `clearCache()` already exists but requires external callers — make it automatic.

---

### Finding 6 — No capture path for the /cortex-capture command when cwd is L1 and project is ambiguous; falls through to an interactive ask that breaks capture flow for mobile-style quick ideas (P2)

**Area:** capture  
**Evidence:** `commands/cortex-capture.md` step 4: "Resolve the active project via the usual rules (most recent project, fuzzy match from conversation context, or ask)." The `cortex-update-context` failure mode table (`skills/cortex-update-context/SKILL.md` line 209): "Project unclear from context — Ask once: 'Is this for <closest-match> or another project?' Do not write until confirmed."

This is the correct guard-rail, but for a content creator capturing a fast-moving idea, the interaction becomes:

1. User: `/cortex-capture note: the 'borrowed authority' technique works well for regulated product writing`
2. Cortex: "Is this for Bubl Shots compliance or the Frankl & Thomas project?"
3. User: interrupted, has to re-engage to answer
4. Cortex: proceeds to write

A writer firing quick captures during a creative sprint ("log this before I forget") experiences every capture attempt as a two-turn interaction when cwd doesn't resolve to a project. The speed benefit of the command disappears.

The `cortex-knowledge` skill has a more appropriate path for cross-project reusable content, but the command doesn't route to it — it routes to `cortex-update-context` which requires a project target.

**Impact:** The `/cortex-capture` command — which looks like the "quick capture" entry point — requires a project resolution that breaks the single-turn speed the persona needs. Ideas captured in haste to avoid forgetting them get caught in a two-turn disambiguation flow.

**Suggested fix:** When the note content clearly passes the reusability test (no project-specific terms, generic technique/pattern), auto-route to `cortex-knowledge` instead of asking for a project. Add a `--kb` flag to `/cortex-capture` for explicit Knowledge Base routing. Only ask for a project when the content is unambiguously project-scoped.

---

## Summary

The daily loop is structurally sound for a developer in a registered repo (L3, clear project context). For a content creator working from multiple starting contexts — often L1 or L2 — the system's safety mechanisms (explicit project resolution, decision-only capture, conservative Tier 3 classification) create exactly the friction this persona fears: ideas that were said out loud but never made it to the vault, no audit trail of what was considered and dropped, and a two-turn overhead on every quick capture attempt outside a registered repo context. The biggest gap is the absence of any soft/inbox-capture path for Tier 2 candidates that the session ends without resolving.

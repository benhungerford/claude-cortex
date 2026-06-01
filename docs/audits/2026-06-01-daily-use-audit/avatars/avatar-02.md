---
avatar: "02"
persona: "Freelance WordPress Dev — 6 clients, rapid context-switching"
audit_date: "2026-06-01"
auditor: "claude-sonnet-4-6 (subagent)"
surface: "Claude Code CLI"
---

# Daily-Use Audit — Avatar 02

## Persona

**Label:** Freelance WordPress Dev — 6 clients, rapid context-switching
**Surface:** Claude Code CLI (macOS, zsh)

**Profile:** Ben manages 6 active WordPress/Shopify clients concurrently. Each project lives in its own repo directory. He opens 4-6 Claude Code sessions per day, typically one per active project, often bouncing between repos mid-morning. Sessions are short (20-40 min) and task-specific: bug fixes, reviewing client feedback, scope changes, filing meeting notes from Granola after client calls.

His vault has 6 registered projects; each project has a hub, a Changelog.md, and a Notes/ folder with 10-30 meeting notes. The index (`.cortex/search.db`) contains ~200 notes. He has `personality.md` and `memory.md` populated.

---

## Simulated Day-in-the-Life

**8:15 AM — First session, FKT Shopify repo**

Ben cds into `~/Code/fkt-checkout` (registered repo). Claude Code opens. `session-start` fires `boot-context.py`. The Python module walks up from cwd, matches the registry entry in `<vault>/.claude/cortex/registry.json`, reads the hub, computes L3. The `<cortex-session>` block arrives. `cortex-boot` reads it; one opening line surfaces the stage and blockers. So far so good.

Ben says "let's look at the Stripe webhook handler." `cortex-boot` calls `recall_related` against `"Stripe webhook handler"`. The MCP server does a vector search, finds 3 notes above 0.5 cosine score. Ben gets a hint: "Worth knowing: you've documented a Stripe idempotency pattern in [[Knowledge Base/Patterns/Stripe Webhooks.md]]." Useful — he had forgotten.

**9:30 AM — Client Slack message, quick context switch**

Ben gets a Slack message from another client (Bubl Shots) with a compliance question. He opens a *new* Claude session from a different repo (`~/Code/bubl-age-verify`). `session-start` fires. This repo is also registered. L3 context loads. Activation level: correct.

But he needs to reference a decision made in the *FKT* session 20 minutes ago — that decision was never explicitly logged because Ben said "yeah let's go with that" without using a trigger phrase like "log that." **The Tier 1 ambient capture rules exist for exactly this, but the ambient watch is model-side behavior that has no persistence between sessions.** If Claude missed the capture in session 1, it's gone.

**10:15 AM — Meeting notes paste from Granola**

Ben pulls up a 35-line Granola transcript for a 30-minute Bubl Shots compliance call. He pastes it raw. The `user-prompt-submit` hook fires: it checks `LINE_COUNT >= 20` (true: 35) and `SPEAKER_COUNT >= 3` (checks for `^[A-Za-z]+: ` pattern). The speaker lines in Granola exports often look like `Ben Hungerford: blah blah` — two words before the colon, not one. The regex `^[A-Za-z]+: ` requires a single word. "Ben Hungerford" does not match. SPEAKER_COUNT comes back 0. The hook misses the hard route. No `<cortex-hint>` for `cortex-process-meeting` is injected.

Ben now has to manually type "process this meeting" to get the skill to fire, which he might or might not know to do.

**11:00 AM — Status check mid-session in a third repo**

Ben opens a session in `~/Code/wp-jumpstart` (another registered repo). He asks "what's the status of Bubl Shots?" — a different project. `cortex-check-status` should fire. The `user-prompt-submit` hook matches `"what's the status"` and injects a hint. Good. But the `cortex-check-status` skill reads the hub from the vault by path. This requires the MCP tool `read_hub` or a manual file read — it does NOT have the Bubl Shots context pre-loaded in the session block because this is an L3 session for Jumpstart. The skill has to do a fresh vault read mid-session. No problem functionally, but it means a noticeable round-trip and file read whereas at L3 the hub is already in the session context for the *current* project.

**12:45 PM — Blocker resolution, spoken naturally**

On the FKT project Ben says "yeah we finally got the Stripe sandbox creds from Ashley." There is no explicit trigger phrase here. The `user-prompt-submit` hook looks for `"unblocked"`, `"that's resolved"`, `"blocker resolved"` — none of which appear in this natural phrasing. No hint fires. Cortex does not capture this blocker resolution unless `cortex-boot`'s ambient capture watch catches it. That watch depends on the model interpreting the sentence as a Tier 1 signal, which is model-side inference with no hook backup. The resolved blocker lives only in conversation memory; if Ben opens a new session later it's gone.

**2:00 PM — Quick knowledge note, wrong trigger phrase**

Ben discovers a WooCommerce HPOS migration gotcha and says "this is worth saving for future projects." The `user-prompt-submit` hook matches `"for future projects"` and routes to `cortex-knowledge`. Good. But if he had said "this is something I'll want to remember" — a completely natural phrasing — there is no pattern match. The trigger phrase list is narrow.

**3:30 PM — Rapid switch between repos, index staleness**

Ben edits a WP theme file directly in VS Code (outside Claude Code). No hook fires. The embeddings index in `.cortex/search.db` is now stale for that file. When he later opens a Claude session and `recall_related` searches for something that file is relevant to, it either returns a stale embedding or nothing. The `reindex-one.js` background job only fires on `post-tool-use` hook events for Write/Edit/Obsidian tools — not for external edits.

**4:45 PM — Embedding cold-start delay on first recall_related call**

Ben's last session of the day. He opens a new session and immediately asks about a vendor pattern he thinks he documented. `recall_related` fires. The HuggingFace transformer model (`Xenova/all-MiniLM-L6-v2`) must load for the first call in the MCP server process. `getExtractor()` in `embeddings.js` lazy-initializes on first call with no pre-warm. For a 384-dimension sentence transformer, the initial pipeline load can take 3-8 seconds depending on the machine. The recall result returns late; if it arrives after Claude has already started composing a response, the surface hint is either lost or injected awkwardly mid-response.

**5:00 PM — Session ends, stop hook**

Claude stops. The `stop` hook fires, flushes `pending-memory.json` if it exists. If no pending memory was queued, it exits silently. Nothing in the daily flow ensures memory accumulation works — it depends entirely on Claude having written to `pending-memory.json` during the session, which is an implicit model-side action with no hook to enforce or verify it.

---

## Findings

### Finding 1 — Transcript auto-route breaks for multi-word speaker names (Granola/Fathom exports)

**Area:** hooks
**Severity:** P1

**Evidence:** `hooks/user-prompt-submit`, lines 63-68:
```bash
SPEAKER_COUNT="$(printf '%s' "$USER_PROMPT" | grep -cE '^[A-Za-z]+: ' 2>/dev/null || echo 0)"
if [[ "$SPEAKER_COUNT" -ge 3 ]]; then
    SKILL="cortex-process-meeting"
```
The regex `^[A-Za-z]+: ` requires a single contiguous alpha word before the colon. Granola and Fathom export transcripts with full names: `Ben Hungerford: blah`, `Ashley Kim: right`. These have a space in the speaker label; they do not match `[A-Za-z]+:` (one unbroken alpha run + colon). The speaker count comes back 0 even for a 40-line Granola transcript. The hard route to `cortex-process-meeting` never fires. The user must type an explicit trigger phrase or the skill won't run.

**Impact:** Every meeting note workflow for Granola/Fathom requires a manual trigger phrase. A primary daily-loop touchpoint silently degrades for the most common transcript source.

**Suggested fix:** Broaden the regex to allow spaces and hyphens in speaker names: `'^[A-Za-z][A-Za-z .\-]*: '` or more simply `'^[A-Za-z].{0,40}: '`. Also consider matching `HH:MM Speaker:` timestamp formats common in Fathom exports.

---

### Finding 2 — Blocker resolution via natural speech never captured without explicit trigger phrase

**Area:** capture
**Severity:** P1

**Evidence:** `hooks/user-prompt-submit`, lines 105-110 (resolved triggers):
```bash
*"that's resolved"*|*"blocker resolved"*|*"unblocked"*)
    SKILL="cortex-update-context"
```
The hook covers only three literal patterns. Natural resolutions — "we got the creds", "they finally sent it", "sorted, Ashley confirmed", "no longer blocked on that" — match nothing. The Tier 1 capture rules (`references/capture-rules.md`, line 27) list "Existing blocker resolved → Remove row from Open Questions" as always-capture, but the hook does not enforce this. It depends on the model's ambient watch, which is session-scoped and has no persistence.

**Impact:** Resolved blockers accumulate in project hubs indefinitely. Status checks report stale open blockers. For a user rapidly context-switching across 6 projects, this is the vault gradually drifting from reality — the single biggest value-destroy for the daily loop.

**Suggested fix:** Expand the resolved trigger patterns to include natural phrasing: `"we got"`, `"finally got"`, `"confirmed"`, `"sorted"`, `"no longer blocked"`, `"they sent"`. These are all common idioms for resolution. Even `"good to go"` in a project context is usually a resolution signal. Also add a soft trigger: anything that references a string matching a known blocker title in the session context should prompt "did you want to clear that blocker?".

---

### Finding 3 — Embedding cold-start delay (3-8s) on first `recall_related` call per MCP process

**Area:** perf
**Severity:** P2

**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js`, lines 13-16:
```js
async function getExtractor() {
  if (!extractorPromise) {
    const { pipeline, env } = await import('@huggingface/transformers');
    extractorPromise = pipeline('feature-extraction', MODEL_ID);
  }
```
`extractorPromise` is module-level, so it persists across calls within the same MCP server process. However, on the first call per process (i.e., the first `recall_related` or `search_vault` call in a new session), the HuggingFace transformer pipeline must be initialized: it loads the ONNX runtime, reads the model weights from disk, and initializes the tokenizer. On a cold disk cache this is 3-8 seconds. The `cortex-boot` skill invokes `recall_related` on the very first substantive turn — exactly when the latency hits.

**Impact:** First recall in each new session has a multi-second stall. For rapid-context-switchers opening 4-6 sessions/day, this is a repeated annoyance. The recall result arriving after Claude has already started answering means the surface hint is silently dropped.

**Suggested fix:** Pre-warm the extractor at MCP server startup (outside of any request handler) so the model is loaded before the first tool call arrives. A `getExtractor()` call with no-op embedding fired at module load time would eliminate the per-session cold-start. Alternatively, add a `warmup` no-op tool the session-start hook can call before the model's first turn.

---

### Finding 4 — Session-cache vault-path.txt is shared across concurrent sessions (multi-repo freelancer breakage)

**Area:** boot
**Severity:** P1

**Evidence:** `hooks/session-start`, lines 40-45:
```bash
CACHE_DIR="$PLUGIN_DATA/session-cache"
mkdir -p "$CACHE_DIR"
python3 -c "import json,sys; print(json.loads(sys.stdin.read())['vault_path'], end='')" \
    <<< "$BOOT_JSON" > "$CACHE_DIR/vault-path.txt"
```
And `hooks/post-tool-use`, lines 69-72:
```bash
CACHE_FILE="$PLUGIN_DATA/session-cache/vault-path.txt"
if [[ -f "$CACHE_FILE" ]]; then
    VAULT_PATH="$(cat "$CACHE_FILE")"
fi
```
`session-cache/vault-path.txt` is a single shared file under `$PLUGIN_DATA`. `PLUGIN_DATA` defaults to `$HOME/.claude/cortex/plugin-data` — a global, per-user directory. If the user has two Claude Code sessions open simultaneously (e.g., one in `~/Code/fkt-checkout` and one in `~/Code/bubl-age-verify`), the second session-start overwrites `vault-path.txt`. The `post-tool-use` hook in the first session then reads the second session's vault path. Since both projects share the same vault in this user's setup, the vault path value is the same and the bug is masked. But if a user has multiple vaults — or if `PLUGIN_DATA` is shared by a worktree setup — `post-tool-use` will log to the wrong vault's `_changelog.txt`.

**Impact:** Incorrect changelog attribution for concurrent sessions. For a power user with worktrees (which the repo itself uses, evidenced by `.claude/worktrees/`) this is a real race condition.

**Suggested fix:** Make the cache keyed by session ID. Claude Code passes a session identifier in the hook environment (or the startup JSON). Use it: `session-cache/<session_id>/vault-path.txt`. If no session ID is available, fall back to a hash of the cwd at session-start time.

---

### Finding 5 — Index staleness: external edits (VS Code, Obsidian) bypass re-embed entirely

**Area:** search
**Severity:** P2

**Evidence:** `hooks/post-tool-use`, lines 194-210:
```bash
if [[ "$FILENAME" == *.md ]]; then
    ...
    if [[ "$SKIP_REINDEX" == "0" ]]; then
        (node "$REINDEX_BIN" "$VAULT_PATH" "$REL_PATH" >/dev/null 2>&1 &) || true
    fi
fi
```
The re-embed trigger only fires on `PostToolUse` for Claude's own `Write`/`Edit`/Obsidian MCP tools. Any edit made outside Claude Code — directly in VS Code, Obsidian, Finder rename — is invisible to the hook. The embeddings in `.cortex/search.db` stay stale until the user explicitly runs `/cortex-index`. A freelancer who maintains their vault in Obsidian (the natural companion app) and only opens Claude Code for dev work will have a permanently semi-stale index. `recall_related` will miss notes that were recently updated in Obsidian.

**Impact:** Ambient recall becomes progressively less trustworthy without periodic manual re-indexing. The knowledge graph drifts from reality. A busy freelancer is unlikely to remember to run `/cortex-index` regularly.

**Suggested fix:** Add a scheduled background re-index: a cron entry (already supported by the platform) that runs `reindex_vault` every few hours. The indexer already hash-compares (`lib/indexer.js` lines 79-80) so re-running on an unchanged vault is fast. Alternatively, surface a prompt at session-start when the index's last-modified time is more than N hours old: "Your vault index is 8 hours old. Run `/cortex-index` to update recall accuracy."

---

### Finding 6 — Token-budget truncation silently drops project blockers during peak-load sessions

**Area:** boot
**Severity:** P2

**Evidence:** `hooks/lib/boot-context.py`, lines 291-364 (`apply_token_budget`):
Priority order for budget fill is: project → personality → recent_activity → memory → learner_profile → active_projects.

When the `project` dict exceeds budget, lines 343-355 truncate it to a high-signal subset: id, name, vault_path, stage, up to 3 blockers, up to 3 open questions, up to 3 recent decisions. This is reasonable.

But the bigger issue is on lines 318-324:
```python
fixed_overhead = (
    estimate_chars(output.get("vault_path"))
    + estimate_chars(output.get("activation_level"))
    + estimate_chars(output.get("inbox_count"))
    + estimate_chars(output.get("feature_suggestion"))
    + 200  # JSON keys + delimiters
)
remaining = budget_chars - fixed_overhead
```
The `DEFAULT_BUDGET_CHARS = 8000`. `personality.md` and `memory.md` together can easily exceed 8,000 characters for an active user with 6 projects and a rich personality file. If personality alone is 5,000 chars and memory is 3,500 chars, the `project` dict — which is highest priority — gets filled first (say 800 chars) but personality then only gets 7,000 chars allocated, which may still truncate it mid-bucket-list. The truncation stub says "Read the full content via the MCP tools (read_hub, search_vault) when needed" — but `cortex-boot` explicitly does NOT read files, and the model has no mechanism to re-fetch personality mid-session.

**Impact:** With a full memory.md and rich personality.md, session context can lose the tail of the personality bucket list (which contains project bucket names) or the memory entries. `cortex-check-status` fuzzy-matching depends on having the bucket names in context; if they're truncated, the skill fails to match project names the user mentions by abbreviation.

**Suggested fix:** Personality's bucket list section should be extracted as a fixed-priority field separate from the full personality content. The bucket names (short name+type strings) are maybe 500 chars for 10 projects — they should never be truncated since they drive all skill routing. Pull `extract_buckets()` result into its own field in the output dict and reserve budget for it separately before the main priority fill runs.

---

## Summary

The most damaging daily-use friction for this persona is the combination of Findings 1, 2, and 4: Granola transcript auto-route failing (every meeting workflow requires a manual trigger), natural blocker-resolution language never captured (vault drifts from reality across all 6 projects), and the shared session-cache creating a race condition across concurrent sessions. These three together mean the daily write path — the part where the vault actually gets kept current — is unreliable without conscious effort from the user. The vault reads (recall, status) work well when the index is fresh. The reads surface the right things. But the writes are the harder problem.

---
audit_date: 2026-06-01
avatar_id: "03"
persona: Non-technical agency project manager — lives in Monday.com, never opens a terminal
surface: Claude Desktop
auditor: Claude Sonnet 4.6 (subagent)
---

# Avatar 03 — Daily-Use Audit

## Persona

**Name:** Agency PM (non-technical)
**Tools of trade:** Monday.com, Granola for meeting capture, email, Zoom
**Relationship to terminal:** None. Has never opened one intentionally. Installed Cortex via someone else's instructions and doesn't fully understand what a "vault" is.
**Working style:** Constant context switching. 6-8 active client projects. Manages by checking status, pasting meeting notes, and asking "where are we on X?" throughout the day.
**Daily Cortex touchpoints (in order):** Morning boot → status checks → meeting paste → ad-hoc decision logging → end-of-day session close.

---

## Day Narrative

It is Monday morning. The PM opens Claude Desktop, intending to pick up on two client projects before a 10am Zoom. They have no idea what session-start hooks do or that Cortex is pre-loading vault data in the background.

**8:47am — Session start.** Claude Desktop opens. The session-start hook fires, `boot-context.py` runs, and the `<cortex-session>` block is injected. The PM's cwd is `~/Documents` — outside the vault — so `resolve_cwd` returns L1. The PM hasn't registered any repos (they don't know what that is). Boot resolves to L1 Passive. Cortex says nothing. The PM types "morning, where are we on FKT?"

This is L1 territory. `cortex-boot` is running silently. The `user-prompt-submit` hook pattern-matches `"where are we on"` at line 149 of `user-prompt-submit`, tags it as `cortex-check-status` (high confidence), and injects a `<cortex-hint>`. Cortex reads the FKT hub and gives a tidy status summary. The PM is pleased.

**9:05am — Blocker resolved.** The PM says: "actually, we got the Stripe creds from the client yesterday — clear that blocker." The trigger `"we got"` at `trigger-phrases.md` row 9 is supposed to route to `cortex-update-context`. But the hook pattern at `user-prompt-submit` line 105 only matches `"that's resolved"`, `"blocker resolved"`, `"unblocked"` — not `"we got <X>"` even though the trigger-phrases reference table documents it. The hint does not fire. Cortex must rely purely on the model to infer the intent without the routing hint. In practice it probably does route correctly, but the latent gap means one missed hint per session type.

**9:12am — Open question/blocker resolved via `open_question` MCP tool.** When `cortex-update-context` tries to resolve the blocker, it calls `mcp__cortex-vault__open_question` with `action: resolve`. The tool's `resolveQuestionInBody` function at `open-question.js:77` marks the line as `- [x] ... — Resolved: ...` (strikethrough checkbox). But the skill doc (`cortex-update-context/SKILL.md` line 92) explicitly states: **"Remove the row entirely. Do not use strikethrough."** The tool contradicts the skill. The resolved blocker stays in the Open Questions section as a checked-off item, accumulating noise the PM will see next time Cortex reads the hub.

**9:30am — Meeting paste.** The PM copies a 25-line Granola export of a client Zoom from earlier this week. The `user-prompt-submit` hook at lines 60-68 detects 20+ lines and 3+ `Name: text` speaker labels and routes to `cortex-process-meeting`. Good. But `thread_meeting` fires — and it requires the new note file already be on disk before threading (`thread-meeting.js:221`): `"New file not found on disk: ... — create it first, then call thread_meeting."` So the skill must create the file, then call `thread_meeting` as a second step. This is an internal sequencing concern, but if the model ever calls `thread_meeting` before the `Write` completes, it fails silently from the PM's perspective (threading just doesn't happen, no error surfaces). For a non-technical user who can't inspect why a meeting isn't threaded, this is invisible data loss.

**10:15am — Status check after meeting.** "What's the status of the Bubl compliance project?" `cortex-check-status` calls `mcp__cortex-vault__read_hub`. The tool (`read-hub.js:44-56`) extracts blockers from `## Open Questions` and `## Blockers` as **separate** sections. But the canonical hub template (`assets/blank-template.md:70`) uses a **combined** `## Open Questions & Blockers` table. So `read_hub` returns `open_questions: []` and `blockers: []` for any correctly-templated hub. The PM gets "no open blockers" when there are 3. Groaning frustration.

**11:00am — Ambient capture at L1.** The PM says mid-conversation: "Yeah we're going with Shopify for Bubl too." This is a Tier 1 decision capture signal under `capture-rules.md`. But Cortex is at L1 because the cwd is `~/Documents` and no project repo is registered. At L1, `capture-rules.md` says: "Cortex never writes to the vault without clear user intent at this level." This is correct behavior — but the user has no idea L1 is the reason nothing is being silently captured. They don't know what L1 is. They assume Cortex heard the decision. It will be lost unless they say "log that" — a trigger phrase they may not know.

**2:00pm — Recall fires.** The PM asks about a Monday.com / Shopify integration they built for a different client last year. `cortex-boot` says ambient recall should call `recall_related`. The MCP call fires. On the first `recall_related` call of the day, `embeddings.js:getExtractor()` lazily loads `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers`. This is a cold model download or warm-up from disk — hundreds of milliseconds to a few seconds, silently, with no UX indicator. The PM sees Claude appear to "stall" for 2-3 seconds mid-response. They have no idea why. They assume the app froze. This persona will click away or re-ask.

**4:45pm — Session end.** The `stop` hook fires and flushes `pending-memory.json` to `memory.md`. This is invisible, which is correct. However the `stop` hook at line 43 also checks `stop_hook_active` to prevent infinite loops — if this JSON field is missing (e.g. malformed stdin from a non-standard Claude Desktop version), `python3 -c "print(...)"` returns `"False"` by string comparison at line 43, which passes through correctly. That's fine. But the hook writes `MEMORY_UPDATED` to `_changelog.txt` with a hardcoded inline format at lines 180-181, bypassing the shared `formatChangelogEntry` via Node (`changelog-format.js`). The inline format is `[$TIMESTAMP] MEMORY_UPDATED [auto] | FILE: memory.md | DEST: memory.md | ...` — `DEST` is the same as `FILE` which doesn't match the convention (DEST should be a directory path). This is a minor drift that could confuse future changelog parsers.

---

## Findings

### 1. `read_hub` returns empty blockers for all standard hub files
**Area:** status  
**Severity:** P0  

**Evidence:** `mcp-servers/cortex-vault/tools/read-hub.js:45,55` — `extractOpenQuestions` looks for `## Open Questions` and `extractBlockers` looks for `## Blockers` as separate headings. The canonical hub template at `assets/blank-template.md:70` uses a single `## Open Questions & Blockers` section. No hub created from the template will have either separate section, so `read_hub` always returns empty arrays for both fields.

**Impact:** Every `cortex-check-status` call that uses `read_hub` silently reports "no blockers, no open questions" for correctly-templated projects. A PM asking "what's blocking FKT?" gets a clean bill of health when three blockers are active. This is a data integrity failure that defeats the core daily-use value proposition.

**Suggested fix:** Change `read-hub.js:45` to `extractSection(body, 'Open Questions & Blockers')` and parse that single section, or support all three section names as fallbacks. Align the template and the parser on one canonical section heading.

---

### 2. `open_question` resolve leaves strikethrough instead of removing the row
**Area:** capture  
**Severity:** P1  

**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js:77` — `resolveQuestionInBody` replaces the matching line with `- [x] originalText — Resolved: ...` (checked checkbox with inline resolution text). `skills/cortex-update-context/SKILL.md:92` states explicitly: **"Remove the row from the Hub's Open Questions table entirely. Do not use strikethrough."** The MCP tool and the skill spec directly contradict each other.

**Impact:** Resolved blockers accumulate as checked-but-visible items in the Open Questions table. A PM doing a status check sees a cluttered hub that doesn't reflect reality. Over weeks this renders the hub unreadable and undermines trust in Cortex's accuracy.

**Suggested fix:** Change `open-question.js:resolveQuestionInBody` to splice the matching line out of the `lines` array entirely (return `lines.filter((_, i) => i !== matchIdx).join('\n')`). The resolution text belongs only in `Changelog.md`, not in-line in the hub table.

---

### 3. `"we got <X>"` blocker-resolved trigger not wired in `user-prompt-submit`
**Area:** capture  
**Severity:** P2  

**Evidence:** `references/trigger-phrases.md:29` documents `"we got <X>"` as a blocker-resolved trigger for `cortex-update-context`. `hooks/user-prompt-submit:105` only matches three patterns: `"that's resolved"`, `"blocker resolved"`, `"unblocked"`. The fourth documented trigger is absent.

**Impact:** The most natural agency PM phrase for clearing a blocker — "we got the creds from the client" — fires no routing hint. Cortex can still infer the intent from the model alone, but without the hint the model is more likely to treat it as context rather than a write intent, especially at L1 where captures are suppressed.

**Suggested fix:** Add `*"we got "*)` to the resolved-triggers `case` block at `user-prompt-submit:105`. Keep the match narrow (the phrase must precede what would be a previously-logged blocker noun phrase — a substring check is sufficient here, exact match isn't needed).

---

### 4. Silent L1 non-capture with no user-visible signal
**Area:** activation  
**Severity:** P2  

**Evidence:** `references/activation-levels.md:17-18` — at L1, "Cortex never writes to the vault without clear user intent." This applies to a non-technical user who opens Claude Desktop from `~/Documents` with no registered repos. All ambient capture is suppressed. `references/capture-rules.md:33` says Tier 1 fires "automatically" — but that contradicts the L1 suppression. The user hears "Logged to FKT Changelog" when at L2/L3 but silence at L1. There is no observable difference between "Cortex heard but didn't log because L1" and "Cortex has no vault context at all."

**Impact:** A non-technical PM who spends their day in `~/Documents` (outside the vault) will lose every ambient decision capture. They have no way to know captures are being suppressed by activation level, no documentation accessible without a terminal, and no one-line notice in chat. The first time they ask "didn't you log that?" the answer is invisible.

**Suggested fix:** When the first Tier 1 capture signal fires at L1 and is suppressed (not just skipped as Tier 3), emit a single session-once line: `"Heads up: I'm running without project context right now — say 'log that to <Project>' to capture decisions, or open Claude from your project folder."` Only once per session. No interruption for Tier 3.

---

### 5. Ambient recall cold-start stall on first `recall_related` call
**Area:** perf  
**Severity:** P2  

**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js:7-16` — `extractorPromise` is initialized to `null` and loaded lazily via `getExtractor()`. The first call to `embed()` during a session triggers `pipeline('feature-extraction', MODEL_ID)` — downloading or loading `Xenova/all-MiniLM-L6-v2` from disk. On a warm disk cache this is 200-600ms; on a cold cache or slow I/O it can exceed 2-3 seconds. There is no progress indicator. The model response appears to stall mid-generation from the user's perspective.

**Impact:** A non-technical user sees an unexplained 2-3 second freeze during what looks like a routine question. The `@huggingface/transformers` progress output is silenced (`env.allowLocalModels = true` is set but no `env.allowRemoteModels = false` fallback guard), so if the model isn't cached the MCP server might hit the network silently. This persona will assume Claude froze and re-ask, potentially doubling the load.

**Suggested fix:** Eagerly warm `extractorPromise` at MCP server startup in `server.js` (call `getExtractor()` in `main()` before connecting transport). The model loads in the background during the first session turn, invisible to the user, and is ready when `recall_related` fires. Zero UX cost.

---

### 6. `stop` hook writes `_changelog.txt` with malformed `DEST` field
**Area:** hooks  
**Severity:** P3  

**Evidence:** `hooks/stop:180-181` — the memory flush changelog entry is constructed inline: `"[$TIMESTAMP] MEMORY_UPDATED [auto] | FILE: memory.md | DEST: memory.md | NOTE: ..."`. The `DEST` field contains the filename (`memory.md`) not a directory path. Every other changelog entry uses a directory path for `DEST` (e.g. `DEST: memory.md` should be `DEST: /` or `DEST: vault root`). `lib/changelog-format.js` is bypassed entirely for this write — the hook has no `PLUGIN_ROOT` reference at that point in the script and falls back to the inline bash format.

**Impact:** Any downstream parser that reads `_changelog.txt` to reconstruct vault activity (e.g. `boot-context.py:read_changelog`, future changelog export tools) will see malformed `DEST` for every memory flush. Low blast radius today but creates technical debt as changelog parsing grows. A PM will never notice directly, but it contributes to silent drift between what's logged and what happened.

**Suggested fix:** In `hooks/stop`, resolve `PLUGIN_ROOT` the same way `post-tool-use` does (lines 181-182 of `post-tool-use`), then delegate to `node "$APPEND_CLI"` for the memory flush entry. Add a `MEMORY_UPDATED` action enum to `changelog-format.js`'s `VALID_ACTIONS` if it isn't already there (it is, at line 12), and pass `dest: "vault root/"`. The bash fallback can stay as a safety net.

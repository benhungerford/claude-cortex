---
avatar_id: "28"
persona: "Note minimalist — irritated by auto-capture noise; tests over-capture / false positives"
surface: "Claude Desktop"
date: "2026-06-01"
auditor: "stress-test-subagent"
---

# Avatar 28 — Daily-Use Audit

## Persona

**Label:** Note minimalist  
**Pain profile:** Irritated by auto-capture noise. Vault is already curated; any false positive — a speculative decision write, an ambient recall that fires on a trivial turn, a one-line confirmation that interrupts flow — is actively hostile. Tests edge cases specifically designed to trigger false positives: thinking out loud, mentioning project names in passing, giving a technical explanation that sounds like a decision but isn't.

---

## Simulated Day in the Life

### 09:10 — First session, Claude Desktop, cwd is `~/Documents`

Session-start hook fires, `boot-context.py` runs. cwd is outside the vault and matches no registry entry, so activation level lands at L1. The `<cortex-session>` block is injected. `cortex-boot` sees L1 and stays silent. Good so far.

First message: "Can you explain how SQLite WAL mode works?"

This is a pure how-to. L1. No capture signal. `user-prompt-submit` hook runs and matches the pattern `explain` — injecting a `<cortex-hint type="teaching-moment">` into context. The hint is invisible to the user, but Claude now "knows" to watch for a learning signal. Annoying but harmless so far.

### 09:25 — Thinking out loud about a decision

Still in the same session. User says: "I'm going to go with WAL mode for the Cortex search DB — it handles concurrent reads well."

**BANG.** The phrase `"going to go with"` is a literal Tier 1 decision trigger (capture-rules.md line 93: `*"going to go with"*` → `cortex-update-context`, confidence: high). The user was just narrating their reasoning out loud, not issuing a capture command. But the trigger-phrase hook fires regardless of activation level — it matches on raw substring in `user-prompt-submit` before cortex-boot's activation contract has any say. The hook injects a `<cortex-hint>likely-skill: cortex-update-context | confidence: high | trigger: "decision trigger"</cortex-hint>`. At L1, cortex-boot says "Cortex never writes to the vault without clear user intent at this level" — but the hint is already injected and cortex-update-context's skill description says it fires ambiently. A model following the hint may attempt a vault write. If the project is unambiguous in registry, the ambient Tier 1 path in capture-rules.md line 32 fires silently.

This is the core false-positive tension: the hook system is activation-level-blind.

### 10:05 — Legitimate status check

User says: "what's the status of FKT?" → `cortex-check-status` fires correctly, reads the hub, gives a tight summary. Clean path.

### 10:30 — Meeting note — minimal, no extras wanted

User pastes 25-line client call notes (has 3 speaker-label lines). The structural heuristic in `user-prompt-submit` lines 62-68 fires: `LINE_COUNT >= 20` AND `SPEAKER_COUNT >= 3` → hard route to `cortex-process-meeting`, confidence: high. The user wanted to paste these notes for context, not necessarily to file them. There is no "are you sure?" gate — the hard route fires.

`cortex-process-meeting` then calls `cortex-update-context` for every extracted decision and blocker. Meeting has 4 decisions. This generates 4 writes, a thread-meeting call, an update-moc call, a changelog append, and a `post-tool-use` hook firing on each write — producing a `<cortex-changelog>` hint per write (lines 213-220 of post-tool-use). Each write also triggers a background `reindex-one.js` call. For a minimalist: the vault explodes with noise, and the changelog gets 8+ entries from one paste.

### 11:00 — Ambient recall interrupts a simple coding task

User says: "Help me write a SQLite migration script."

`cortex-boot` step 6 fires `recall_related` with the user's request as context. Returns 5 notes with scores. One note scores 0.52 (just above the 0.5 threshold). Model surfaces it: "Worth knowing: you've already documented this pattern in [[SQLite Migration Pattern]]."

The user didn't ask for this. The threshold is 0.5 — which, given the `score = 1 - distance/2` formula in recall-related.js line 82, corresponds to a cosine distance of 1.0. That is an extremely permissive floor. Notes with middling semantic similarity will consistently clear 0.5 and generate interruptions for minimalist users.

### 14:00 — "reusable" word appears in casual sentence

User asks: "Is there a reusable way to handle OAuth tokens across multiple services?"

The word `"reusable"` is a literal Tier 1 knowledge trigger (trigger-phrases.md row 15, user-prompt-submit line 127: `*"reusable"*`). Hook routes to `cortex-knowledge`, confidence: medium. User was asking a generic technical question, not instructing a knowledge capture. The skill may now prompt to extract something to Knowledge Base even though nothing was decided.

### 17:30 — Session end, stop hook fires

`stop` hook reads `pending-memory.json`. If the model wrote any pending memory updates during the session (e.g. from the ambient teaching-moment detection), they flush to `memory.md` without user review. The user sees `<cortex-memory>Flushed N pending memory update(s)` as `additionalContext` — but in Claude Desktop this may appear as a subtle banner, not a visible confirmation in chat. The content of what was written is not shown, only the count.

---

## Findings

### Finding 1 — Activation-level contract is not enforced by the hook layer

**Area:** capture  
**Severity:** P1  
**Evidence:** `hooks/user-prompt-submit` lines 83-111 pattern-match on raw user text and inject `<cortex-hint>likely-skill: cortex-update-context | confidence: high` regardless of the current activation level. `references/activation-levels.md` line 17 states "Cortex never writes to the vault without clear user intent at this level" for L1 — but the hook has no access to the session's activation level. The hint is injected unconditionally, and `capture-rules.md` lines 28-33 authorize silent Tier 1 writes whenever the signal appears. A model seeing a high-confidence hint at L1 has textual permission from both the hint and the capture rules to write silently.  
**Impact:** Thinking-out-loud phrases like "I'm going to go with X" or "we decided on Y" during an L1 session (cwd outside vault, incidental project mention) can silently trigger vault writes. The minimalist user's vault is modified without their knowledge.  
**Suggested fix:** Add activation level to the session-cache at boot time (`PLUGIN_DATA/session-cache/activation-level.txt`) and read it in `user-prompt-submit`. For L1 sessions, downgrade all hint confidences to `low` and strip the `likely-skill` field entirely, or suppress the hint. The model already has the L1 contract from cortex-boot; the hook should not contradict it.

---

### Finding 2 — Structural transcript detection fires on pastes that aren't filing requests

**Area:** capture  
**Severity:** P1  
**Evidence:** `hooks/user-prompt-submit` lines 60-68: if `LINE_COUNT >= 20` AND `SPEAKER_COUNT >= 3`, the hook hard-routes to `cortex-process-meeting` at high confidence. The check is purely structural — it does not look for any intent signal from the user ("process this", "file this"). `cortex-process-meeting/SKILL.md` line 3 says the skill "fires on transcript paste" as a structural trigger with no confirmation step.  
**Impact:** A user who pastes a meeting transcript to discuss its content — "here's context from the call, now help me draft a follow-up email" — will instead trigger a full meeting-filing workflow: notes created, MOC updated, hub written, changelog logged. For a minimalist who curates every vault entry, this is actively hostile: the vault gets populated with a note they did not request.  
**Suggested fix:** In `user-prompt-submit`, structural transcript detection should inject a `cortex-hint` at `confidence: medium`, not high, and `cortex-process-meeting` should open with a single confirming question: "This looks like a meeting transcript — want me to file it, or just use it as context?" Only proceed on yes. The hard-route override should be reserved for Granola/Fathom MCP tool returns (row 14 of trigger-phrases.md), not raw pastes.

---

### Finding 3 — recall_related threshold (0.5) is too permissive for minimalist users; no opt-out mechanism exists

**Area:** recall  
**Severity:** P2  
**Evidence:** `skills/cortex-boot/SKILL.md` lines 85-87: "Only surface results that have `score > 0.5`. Everything below that is noise." In `mcp-servers/cortex-vault/tools/recall-related.js` line 82, `score = 1 - r.distance / 2`. A score of 0.5 corresponds to a cosine distance of 1.0 — which for a 384-dimensional MiniLM model means the two vectors are almost orthogonal. Practically, any topically adjacent note will clear this bar. For a vault with 100+ notes, multiple results will score above 0.5 on almost any substantive prompt.  
**Impact:** Every substantive task the minimalist user starts triggers an "ambient recall" surface ("Worth knowing: you've already documented..."). For a user whose primary irritation is noise, unprompted vault citations on every turn is friction, not assistance.  
**Suggested fix:** Raise the threshold to 0.7 (well above random similarity) as the default. Expose it as a `personality.md` preference field: `recall_threshold: 0.7`. Also add an activation-level gate: skip ambient recall at L1 entirely (user has not declared vault relevance). The current L1 spec in cortex-boot step 6 doesn't distinguish — it says "when the user starts a substantive task" without excluding L1.

---

### Finding 4 — post-tool-use changelog noise: every vault edit generates a `<cortex-changelog>` hint in chat context

**Area:** hooks  
**Severity:** P2  
**Evidence:** `hooks/post-tool-use` lines 213-220: after every vault write, the hook builds a `<cortex-changelog>` block and injects it as `additionalContext`. For a meeting with 4 decisions, `cortex-process-meeting` produces: 1 note CREATED, 4 hub UPDATED (via cortex-update-context), 1 MOC_UPDATED, 2 Changelog.md UPDATED — 8 PostToolUse hook firings, each injecting a hint. These hints pile up in the model's context window for that turn, consuming tokens and potentially causing the model to narrate each write separately instead of batching into one confirmation line as capture-rules.md intends.  
**Impact:** The model violates its own "Batch consecutive captures" rule (capture-rules.md line 71) because each write arrives as a separate context injection. The minimalist user sees multiple "Auto-logged: UPDATED | ..." messages instead of one clean line.  
**Suggested fix:** The post-tool-use hook should track write count in the session cache and only emit one `<cortex-changelog>` hint at the end of a batch of writes within the same model turn. Alternatively, suppress the hint entirely for automated writes (ACTION comes from hook, not skill) and let the skill's own confirmation line be the sole user-facing signal.

---

### Finding 5 — "reusable" and "explain" are substring triggers that fire on generic English words

**Area:** capture  
**Severity:** P2  
**Evidence:** `hooks/user-prompt-submit` lines 127 and 175: the knowledge trigger matches on `*"reusable"*` and the teaching-moment hint matches on `*"explain"*`. These are case-glob substrings, not word-boundary matches. `references/trigger-phrases.md` lines 73-75 says "Whole-word match preferred over substring — 'log' alone should not trigger cortex-update-context." However the glob patterns `*"reusable"*` and `*"explain"*` in the hook's `case` statement match these words anywhere in the sentence, including in unrelated technical discussion. A question like "Is there a reusable abstraction for this?" or "Can you explain the trade-offs?" fires the trigger.  
**Impact:** Technical conversations that naturally use words like "reusable", "explain", "worth remembering" are constantly misclassified and route hints to knowledge-capture or teaching-moment logging. For a minimalist, the false-positive rate for these two triggers specifically is high enough to be a daily nuisance.  
**Suggested fix:** For the knowledge triggers, require at least one of the phrase-anchors ("add to knowledge base", "save this pattern", "for future projects") to appear alongside "reusable" — treat bare "reusable" as insufficient. For teaching-moment detection, require `explain` to appear in an imperative context ("explain X to me", "walk me through") rather than a question about trade-offs. Alternatively, drop teaching-moment detection from `user-prompt-submit` entirely and rely on the stop hook's signal logging only for coach-triggered sessions.

---

### Finding 6 — stop hook memory flush is silent about content; user cannot audit what was written

**Area:** hooks  
**Severity:** P2  
**Evidence:** `hooks/stop` lines 138-170: the stop hook appends each `entry.get('content', '')` from `pending-memory.json` directly to `memory.md` (line 167: `f.write('\n' + content + '\n')`). The only user-facing output is line 193: `"Flushed N pending memory update(s) to vault memory.md."` — a count with no content preview. The `pending-memory.json` file is then deleted (line 184: `rm -f "$PENDING_FILE"`). In Claude Desktop, `additionalContext` from the Stop hook may not appear in the chat transcript at all (it's injected as a hook output, not a model response).  
**Impact:** Memory facts are written to the vault without the minimalist user ever seeing what was written or consenting to it. The only way to audit is to open `memory.md` in Obsidian and compare to a prior version. The flush is irreversible within the session (no undo mechanism). For a user who curates their vault carefully, silent memory writes are a privacy and data-quality concern.  
**Suggested fix:** Before flushing, the stop hook should write the pending content to a `<cortex-memory-preview>` block in `additionalContext` so the model can surface "I'm about to write these N facts to memory.md — confirm?" as its final response. Alternatively, move the flush to the start of the *next* session (not the end of the current one) so the user can review `pending-memory.json` before it lands.

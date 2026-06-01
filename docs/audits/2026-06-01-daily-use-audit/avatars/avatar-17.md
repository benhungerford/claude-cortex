# Avatar 17 — ESL Daily-Use Audit
**Date:** 2026-06-01
**Surface:** Claude Desktop
**Persona:** ESL user (non-native English). Uses idioms loosely and non-canonically. Sends short, compressed messages. Tests trigger-phrase robustness with near-miss phrasing. May phrase status questions as "how is going with X" rather than "what's the status of X", or say "we fix the blocker" instead of "blocker resolved", or "this is important, save it" rather than "worth remembering".

---

## Day-in-the-life Narrative

**08:30 — Session starts in a project repo.**
Avatar opens Claude Desktop in their cwd (a Shopify repo registered to a client project). The session-start hook fires, `boot-context.py` walks up, finds a registry match, computes L3. The `<cortex-session>` block arrives with project name, stage, and blockers. `cortex-boot` fires before the first user message and delivers the L3 one-liner: project name, stage, 2 open blockers.

Avatar's first message: _"ok morning, let's go"_ — natural, casual. Cortex responds correctly (L3 boot line was already delivered).

**09:15 — Status check, non-standard phrasing.**
Avatar types: _"how is going with the stripe stuff?"_

The `user-prompt-submit` hook lowercases and pattern-matches against `references/trigger-phrases.md`. The canonical trigger is `*"what's the status of <X>"*`, `*"where are we on <X>"*`, `*"what's left on <X>"*`, or `*"what's blocking <X>"*`. The message _"how is going with"_ matches none of these literals. No `<cortex-hint>` is injected. The model is flying without a skill hint. At L3 it may still answer from the loaded hub, but there's no routing guarantee — the hint was meant to ensure `cortex-check-status` is invoked with the read-only / cite-everything discipline.

**10:00 — Meeting transcript paste.**
Avatar pastes 25 lines of meeting notes in a format common outside North America: no "Speaker: text" prefix, instead lines like `[Ben] decision about shipping dates` and `[Client] agreed on the fee`. The `user-prompt-submit` hook's transcript detector (line 62–68 of `user-prompt-submit`) looks for `^[A-Za-z]+: ` pattern via `grep -cE`. The `[Name]` bracket format produces zero matches. Speaker count = 0 < 3, so no hard-route to `cortex-process-meeting`. The 25-line paste goes undetected as a transcript. Avatar gets no routing hint; the model may still figure it out, but the hook's quick-path protection is absent.

**10:45 — Decision logging, ESL phrasing.**
Avatar says: _"i think we go with Stripe, decided"_

The `user-prompt-submit` hook checks `*"we decided"*`, `*"decision:"*`, `*"i'm going with"*`, etc. (line 93). The phrase _"decided"_ as a standalone trailing word does not match any canonical trigger. There's no `*"decided"*` bare-word pattern in the hook. No hint is injected. The model may still pick this up via ambient capture in `cortex-boot`, but the routing layer provided no explicit nudge toward `cortex-update-context`.

**11:30 — Blocker resolved, ESL phrasing.**
Avatar says: _"we fix the stripe problem, it's done"_

The hook checks for `*"that's resolved"*`, `*"blocker resolved"*`, `*"unblocked"*` (lines 104–108 of `user-prompt-submit`). The message _"we fix"_ / _"it's done"_ matches nothing. No hint is injected. If the model doesn't contextually infer a blocker resolution from L3 state, the blocker row may persist in the hub despite the user verbally clearing it.

**13:00 — Knowledge save, loose idiom.**
Avatar: _"this is important, save it for later"_

The knowledge triggers are `*"worth remembering"*`, `*"reusable"*`, `*"add to knowledge base"*`, `*"save this pattern"*`, `*"for future projects"*` (lines 127–129). The phrase _"save it for later"_ matches none of them. No `cortex-knowledge` hint is injected. The user's intent to capture reusable knowledge is silently dropped unless the model's ambient watch catches it — which requires a very strong contextual inference since neither the hook nor a trigger phrase fires.

**14:30 — Ambient recall fires during a task.**
Avatar starts discussing a new feature: _"i want to add age gate on the site"_. Cortex invokes `recall_related` with that phrase. The MCP tool calls `embed()` which lazy-loads the `Xenova/all-MiniLM-L6-v2` model via `@huggingface/transformers`. First call in the session: the model download + JIT load can take 10–30 seconds on a cold start (no cache). The user sees no progress indicator — the MCP call appears to hang. This is particularly disorienting for a non-native speaker who may not know whether something is stuck vs. thinking.

**15:00 — Status question, abbreviated style.**
Avatar types: _"stripe blocker?"_ — just two words.

The hook checks for status-side triggers. `*"what's blocking"*` is the closest match, but the bare _"stripe blocker?"_ doesn't contain it. No hint. No skill route. The user gets whatever the model's general understanding of the conversation delivers — not the structured, hub-cited `cortex-check-status` output with `Sources:` citation.

**16:30 — Session ends.**
Stop hook fires. If there are pending memory updates, they get flushed to `memory.md`. Works correctly.

---

## Findings

### Finding 1 — Status trigger coverage misses non-native interrogative forms

**Severity:** P1

**Area:** hooks (user-prompt-submit trigger matching)

**Evidence:** `hooks/user-prompt-submit` lines 148–154. Canonical status triggers are: `"status of"`, `"what's the status"`, `"where are we on"`, `"what's left on"`, `"what's blocking"`, `"any open questions"`. An ESL user asking _"how is going with X"_, _"how stands X"_, _"what happen with X"_, _"stripe blocker?"_ (bare noun phrase) triggers none of these case-insensitive literals. The hook emits `{}` — no hint. Also missing: _"is X unblocked"_, _"how far along is X"_, _"any news on X"_.

**Impact:** `cortex-check-status` skill discipline (read-only, cite every fact, `Sources:` line) is bypassed. The model may still answer from L3 hub context, but without the structured routing the answer quality is inconsistent and uncited.

**Suggested fix:** Add broader status-intent patterns to the case block in `user-prompt-submit` lines 148–154:
```bash
*"how is going"*|*"how go"*|*"what happen with"*|*"any news on"*|*"how far"*|*"is it done"*|*"still blocking"*|*" blocker?"*)
```
Also add a catch-all: any message of 1–4 words that ends with a known project name and a `?` mark can route to `cortex-check-status` with `confidence: low`. Low-confidence hints don't force the skill but do alert the model to consider it.

---

### Finding 2 — Transcript speaker-label detector breaks on bracket format

**Severity:** P1

**Area:** hooks (user-prompt-submit transcript detection)

**Evidence:** `hooks/user-prompt-submit` lines 62–68. Detection uses `grep -cE '^[A-Za-z]+: '` — expects `Name: text` (colon-space immediately after bare name). Formats produced by many non-US meeting tools, including Granola's non-English fallback, Zoom auto-transcripts from non-English locales, Google Meet recordings, and manual note-taking conventions common in Asia/Europe/LatAm, use `[Name]`, `(Name)`, `Name –`, or `Name — ` formats. All produce zero matches. A 25-line paste with bracket labels falls silently through to no hint. The meeting is never hard-routed to `cortex-process-meeting`.

**Impact:** Meeting notes from non-standard formats go undetected. `cortex-process-meeting` skill (threading, hub extraction, MOC update) doesn't fire. Meeting data lands as a blob in conversation context, not in the vault.

**Suggested fix:** Extend the regex in `user-prompt-submit` to also match `[Name]`, `(Name)`, and `Name — ` patterns:
```bash
SPEAKER_COUNT="$(printf '%s' "$USER_PROMPT" | grep -cE '^(\[?[A-Za-z][A-Za-z ]+\]?|[A-Za-z][A-Za-z ]+ ?[—:\-]) ' 2>/dev/null || echo 0)"
```
Also add the explicit meeting phrase `"notes from"` (without `"here are the"` prefix) to the literal trigger list at lines 74–78 — many ESL users write _"notes from the call"_ not _"here are the notes from"_.

---

### Finding 3 — Blocker-resolved trigger set requires native English idioms

**Severity:** P1

**Area:** hooks (user-prompt-submit trigger matching) + capture

**Evidence:** `hooks/user-prompt-submit` lines 104–109. Resolved triggers: `"that's resolved"`, `"blocker resolved"`, `"unblocked"`. These are all native English formulations. Common ESL equivalents that go unmatched: _"we fix it"_, _"it's done now"_, _"problem solved"_, _"we got through it"_, _"done with that"_, _"not blocking anymore"_, _"issue is close"_ (closed → close is a common ESL conjugation error).

Also in `references/trigger-phrases.md` row 9: `"we got <X>"` is listed as a trigger but is NOT implemented in the hook's bash case block. The hook has no pattern matching this form.

**Impact:** A blocker cleared verbally by an ESL speaker is not routed to `cortex-update-context`. The Open Questions table in the hub retains the stale blocker. The L3 session continues surfacing a "resolved" blocker as active. At next session, boot-context reads the stale row and reports it in the L3 opening line — the user sees a blocker they cleared yesterday listed again.

**Suggested fix:**
1. Add to the resolved case block: `*"problem solved"*|*"we fix"*|*"it's done"*|*"not blocking"*|*"all done"*|*"we got it"*|*"no more blocker"*|*"issue close"*`.
2. Implement the `"we got <X>"` pattern from the trigger-phrases spec (row 9) which is currently doc-only, not code. A heuristic: if the message contains `"we got"` or `"got the"` + a word that fuzzy-matches an open blocker in the loaded hub, route to `cortex-update-context` with `confidence: medium`.

---

### Finding 4 — Ambient recall `embed()` cold-start latency is invisible to the user

**Severity:** P2

**Area:** perf + ux

**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js` lines 9–17. The `getExtractor()` function lazy-loads `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers`. First call per process: model weights (~25 MB) must be loaded and JIT-compiled. On macOS with cold disk cache this can take 10–30 seconds. The `extractorPromise` singleton caches it for subsequent calls in the same server process, but each new MCP server boot (e.g., after Claude Desktop restart) restarts cold. During this latency, `recall_related` is blocked, and the MCP tool call returns no progress signal to the conversation. The user sees nothing — not a spinner, not a "searching..." message, not an error. The tool appears to hang.

For an ESL user who may already be uncertain whether their message was understood, a silent 20-second pause during the first `recall_related` call of the day is alarming. They may re-send the message, triggering duplicate processing.

**Impact:** Confusing silent delay on first semantic recall of each session. May cause duplicate prompts. If the user closes and reopens, the cold-start repeats.

**Suggested fix:** Two mitigations:
1. In `cortex-boot`'s ambient recall section (SKILL.md line 86), note that the first `recall_related` call of a session may have a warm-up delay. The skill should emit a brief one-liner before calling the tool: `"Searching vault..."` — already consistent with the "surface relevant hits in one short line" rule, just applied as a pre-call affordance.
2. Optionally, pre-warm the embeddings model during `session-start` by firing a trivial `embed("")` call in the background. This has a cost (adds ~20s to session-start), but at least the latency is front-loaded before the user notices it.

---

### Finding 5 — "save it for later" and loose knowledge-save idioms are uncovered

**Severity:** P2

**Area:** capture + hooks

**Evidence:** `hooks/user-prompt-submit` lines 126–132 (knowledge triggers): `"worth remembering"`, `"reusable"`, `"add to knowledge base"`, `"save this pattern"`, `"for future projects"`. The phrase `"save it for later"`, `"keep this"`, `"remember this"`, `"don't forget this"`, `"important for next time"`, `"write this down"` (very common ESL imperative) all go unmatched. The `references/trigger-phrases.md` row 15 lists `"file as a reference"` as a trigger but it is missing from the hook's case block (line 127 has `"add to knowledge base"` but not `"file as a reference"`).

Also: `"file as a reference"` appears in the SKILL.md description but the `user-prompt-submit` hook does not include it. This is a doc-vs-code divergence: the trigger-phrases spec says it routes there, the hook does not implement it.

**Impact:** ESL user's explicit knowledge-save intent — expressed in natural but non-canonical English — silently fails to route to `cortex-knowledge`. The knowledge is lost to the vault. No failure message. The user doesn't know they needed a magic phrase.

**Suggested fix:**
1. Add to the knowledge triggers case block: `*"save it for"*|*"keep this"*|*"remember this"*|*"don't forget"*|*"important for next"*|*"write this down"*|*"file as a reference"*`.
2. Fix the doc-vs-code gap: `"file as a reference"` must be added to the hook's case block to match the spec in `references/trigger-phrases.md` row 15.

---

### Finding 6 — Decision trigger "decided" as trailing word is unmatched; `"going to go with"` has a whitespace hazard

**Severity:** P2

**Area:** hooks (user-prompt-submit decision triggers)

**Evidence:** `hooks/user-prompt-submit` lines 93–96. Decision triggers: `"we decided"`, `"decision:"`, `"i'm going with"`, `"going to go with"`, `"final answer is"`, `"we're using "`. Two gaps for ESL users:

1. `"decided"` as a bare past tense trailing word — _"i think we go with Stripe, decided"_ or _"decided, Stripe"_ — is not covered. The trigger requires the full phrase `"we decided"`. English learners frequently front-load the verb-phrase or drop the subject pronoun.

2. `"we're using "` (line 95) has a trailing space inside the glob pattern. In bash `case` with `*"..."*` matching, the trailing space is part of the literal. The message _"we're using Stripe"_ matches because it has text after the space, but _"we're using"_ alone (user hit Enter early, common for mobile/ESL) would not match. Also, the contraction `we're` requires the exact apostrophe character — a message typed on a keyboard with typographic quotes (`we're` with U+2019) would not match the ASCII `'` in the pattern.

**Impact:** Decision capture misses ESL phrasing that front-loads "decided" or omits subject pronouns. The `we're` apostrophe hazard is latent on any iOS or macOS autocorrect session (autocorrect replaces `'` with `'`).

**Suggested fix:**
1. Add `*"decided"*|*", decided"*|*"decided:"*|*"decision is"*|*"decision was"*` to the decision case block.
2. Add `*"going with"*` (without `"i'm"` prefix) and `*"we use"*` (ESL present-for-future).
3. For the apostrophe hazard: before the case matching step, normalize curly/typographic quotes to ASCII in the `LOWER` string. Add one line after line 50: `LOWER="${LOWER//\'/\'}"` but since bash string replacement doesn't easily handle Unicode, do it in the python3 step that extracts `USER_PROMPT`: add `.replace('’', "'")` to the Python extraction in line 35.

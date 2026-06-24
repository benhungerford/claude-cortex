---
avatar: "08"
persona: "UX Designer — Figma-centric, visual thinker, captures design decisions and critique notes"
surface: "Claude Desktop"
date: 2026-06-01
---

# Avatar 08 — Daily-Use Audit

## Persona

**Name:** Maya (composite UX designer)
**Surface:** Claude Desktop
**Work style:** Splits the day between Figma, design critique sessions, client feedback calls, and writing design-rationale notes in Obsidian. Captures a high volume of *why-not-what* decisions: typography rationale, component naming, spacing-system trade-offs, client critique pushback. Uses Granola for meeting recordings. Not a developer; never opens a terminal intentionally. Vault is large: 4+ active project hubs, each with a Design System sub-note.

---

## Simulated Day-in-the-Life

**9:05 AM — Morning boot, Figma open in background.**
Maya opens Claude Desktop to ask a quick question about contrast ratios. She's in `~/Documents/Random/` — no project context. Boot fires. The session-start hook runs `boot-context.py`, resolves L1 (no vault match), and assembles a `<cortex-session>` block. `cortex-boot` skill fires first turn. No visible output — correct L1 behavior. So far fine.

**9:20 AM — Ambient capture attempt, design decision.**
Mid-conversation: "yeah I'm going with Inter over Neue Haas because the client already has it in their Google Fonts plan." This is a Tier 1 design decision. `cortex-boot` should fire ambient capture. But Maya is at L1 (cwd outside vault, project name not mentioned yet). Capture rules say L1 "never writes to the vault without clear user intent." The decision goes unlogged. Maya doesn't think to say "log that" because she doesn't use explicit trigger phrases — she just talks.

**10:00 AM — Figma critique session ends. Paste Granola transcript.**
Maya switches to Claude Desktop and pastes the Granola export of a 45-minute design-critique call. The `user-prompt-submit` hook detects the structural signal (20+ lines, speaker labels). `cortex-hint: cortex-process-meeting` fires. 

The skill must route the meeting. The transcript mentions "the checkout redesign" and "we also touched on the Bubl Shots brand refresh briefly." The skill's Example 3 covers this cross-project scenario. However, the skill relies on reading `personality.md` for the bucket list to identify which projects exist. If the Design System sub-note uses a non-standard section name (e.g. `## Visual Tokens` instead of `## Design Tokens`), `read-hub.js` parses it via hardcoded section names (`extractSection(body, 'Open Questions')`, `extractSection(body, 'Blockers')`) — sections that don't match the Design System sub-note template at all. Design decisions from the call will be routed to the project hub instead of the Design System sub-note, silently producing a mis-filed capture.

**10:40 AM — Meeting processed. Cortex says "extracted 2 decisions."**
Maya wants to verify. She asks "what's the status of the checkout redesign?" `cortex-check-status` fires, reads the project hub. The two "extracted" design decisions (typography rationale, component variant rule) are now in the Changelog — but the Design System sub-note is untouched. Maya's colleague will open the Design System note in Obsidian later expecting those decisions to be there and find nothing.

**11:15 AM — Ambient recall triggers mid-task.**
Maya says "I want to revisit how we handled the icon sizing system on the FOND project." `cortex-boot` fires `recall_related` with this as context. The embedding model (`Xenova/all-MiniLM-L6-v2`) must be loaded. This is the *first* recall call of the session — the model is not yet warm. Loading `@huggingface/transformers` pipeline on cold start (no `extractorPromise` cached) takes 2–5 seconds inside a synchronous MCP tool call. From Maya's perspective, the response pauses noticeably before her question is answered. No spinner, no indication anything is happening. She assumes Claude Desktop froze.

**1:30 PM — Afternoon: "log that we're dropping the sticky header on mobile"**
Explicit trigger phrase. `user-prompt-submit` hook catches `"we decided"` (it doesn't catch "log that we're dropping" directly — let's check: the pattern is `*"log that"*`; "log that we're dropping" does contain "log that" as substring, so the `cortex-update-context` hint fires). Good. The skill routes this as a design decision. But "sticky header on mobile" is a layout decision — does it go to Design System sub-note or to the hub's Overview? The routing table in the SKILL.md says "Design decision (tokens, typography, layout direction) → Design System sub-note." This routing is correct per the spec. However, the workflow file (`workflows/update-context.md`) says only "Design decision → Relevant sub-note (per personality.md sub_note_types)" without naming "Design System" explicitly. The actual sub-note the model picks depends on what `personality.md` lists. If the user's vault has the sub-note named "Visual Design" instead of "Design System," the routing is personality-driven and correct. But the SKILL.md hardcodes "Design System sub-note" in its table while the workflow defers to personality.md — subtle inconsistency that becomes real friction if Maya's vault was scaffolded with a non-default sub-note name.

**2:45 PM — "what happened on the FKT project last week?"**
This matches no explicit trigger in `user-prompt-submit` (pattern: `*"what happened recently"*` is mentioned in activation-levels.md but is NOT in the `user-prompt-submit` hook patterns). No `<cortex-hint>` injected. Claude Desktop responds as a general question. `cortex-check-status` never fires. Maya gets a weaker answer than she would if the status skill had been invoked. Missed opportunity.

**4:00 PM — End of day. Session stop. Memory flush.**
Stop hook runs. If `pending-memory.json` is non-empty, it appends to `memory.md`. The stop hook calls `python3` inline and appends raw `content` fields with no deduplication: if a session-level memory entry about "Maya prefers Inter for body type" was written across two sessions, it will appear twice in `memory.md`. The 100-line cap in `read_memory` at boot means duplicate entries displace other meaningful memories.

---

## Findings

### Finding 1 — Design decisions silently mis-routed to hub when Design System sub-note extraction is not triggered

**Area:** capture  
**Severity:** P1

**Evidence:** `skills/cortex-update-context/SKILL.md` lines 63–68 specifies the routing table: "Design decision (tokens, typography, layout direction) → Design System sub-note." However, `workflows/update-context.md` lines 22–31 renders this as "Design decision → Relevant sub-note (per personality.md sub_note_types)" with no fallback behavior specified if the sub-note name doesn't exactly match or if the model can't locate it. More critically, `mcp-servers/cortex-vault/tools/read-hub.js` parses hub files with hardcoded section extractors (`extractSection(body, 'Open Questions')`, `extractSection(body, 'Blockers')` at lines 44–65) — there is no equivalent section-aware extraction for Design System content. When `cortex-process-meeting` calls `cortex-update-context` to file design decisions extracted from a critique transcript, the call to `read_hub` returns only `open_questions`, `blockers`, `current_phase`, and `key_decisions` (lines 113–118). Design decisions from a meeting therefore land in the Changelog entry only, not in the Design System sub-note. For a UX designer whose primary artifact *is* the Design System note, this is silent mis-capture: the right "log confirmed" message appears in chat, but the Design System note is never written.

**Impact:** Design rationale decisions (typography, spacing, component variants, layout rules) accumulate in the Changelog but are absent from the Design System sub-note. A designer or collaborator opening Obsidian to reference the Design System finds stale or empty content. The vault's design source-of-truth degrades over time.

**Suggested fix:** In `cortex-process-meeting/SKILL.md` and the `workflows/process-meeting.md`, add an explicit extraction category for "visual/design decisions" that always routes to the Design System sub-note (or the equivalent sub-note_type listed in personality.md) rather than relying on the generic `cortex-update-context` routing. Add a validation step: after a design decision handoff, confirm the Design System sub-note was actually updated, not only the Changelog.

---

### Finding 2 — Cold-start embedding latency on first `recall_related` call has no user-visible feedback

**Area:** perf  
**Severity:** P2

**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js` lines 8–16: `extractorPromise` is module-level state initialized to `null`. The first `embed()` call per process runs `pipeline('feature-extraction', MODEL_ID)` via `@huggingface/transformers`. This is a full model-load operation (downloads and initializes `Xenova/all-MiniLM-L6-v2`, ~23 MB). In the MCP server process, this runs inside the synchronous tool-call cycle. Subsequent calls within the same MCP server process reuse the cached promise (correct), but the *first* call per session has a 2–8 second cold-start penalty depending on disk speed and whether the model is in OS file cache. There is no progress signal emitted: `env.allowLocalModels = true` silences even progress spam (line 13). The `recall_related` tool handler at `tools/recall-related.js` line 41 calls `embed(truncated)` with no timeout wrapper.

**Impact:** On the first substantive task of a session, Claude Desktop pauses silently for 2–8 seconds. For a visual thinker who moves quickly between context windows and Figma, this reads as a crash or hang. No spinner, no "loading model" hint. If Claude Desktop has a response timeout that fires before the model loads, the entire recall step is dropped silently and no related notes are surfaced — wasting the ambient-recall feature entirely.

**Suggested fix:** Add a startup-time model pre-warm call in the MCP server bootstrap (`server.js` or `bootstrap.js`) that fires `embed("warmup")` asynchronously when the server initializes, before any tool calls arrive. This amortizes the cold-start cost to server startup rather than first user request. Alternatively, add a `try/catch` with a timeout (e.g. 3 seconds) in `recall_related`'s handler; if `embed` times out, return an empty result rather than stalling the session.

---

### Finding 3 — L1 sessions silently drop Tier 1 design decisions because capture requires explicit project context

**Area:** capture  
**Severity:** P1

**Evidence:** `references/activation-levels.md` lines 17–19: At L1, "Cortex never writes to the vault without clear user intent." `references/capture-rules.md` lines 22–35: Tier 1 fires automatically for "scope, strategy, or direction decisions" — but its routing requires a destination ("Project hub + Changelog.md"). When the cwd is outside the vault and no project name has been mentioned, `boot-context.py` resolves to `activation_level = 1` (line 154: `return 1, None`). With `project_entry = None`, there is no hub to write to. The Tier 1 capture rule fires in the model's behavior layer, but the write destination doesn't exist — the only recoverable path is to escalate to Tier 2 and ask the user which project, but `capture-rules.md` line 33 says "Tier 1 never asks permission." This creates a dead branch: Tier 1 fires for a clear design decision (the model recognizes it), but with no known project and no permission to ask, the safest behavior is to drop the capture.

**Impact:** A UX designer working at L1 (very common — opening Claude Desktop from a Figma link or from the desktop, not from a project folder) will have design decisions, typography rationale, and client preference statements go silently unlogged. The vault becomes incomplete. The designer may not notice until weeks later when they can't find the rationale for a component decision.

**Suggested fix:** At L1, when a Tier 1 signal fires and there is no resolved project, escalate to a lightweight Tier 2 ask: "That sounds like a decision worth logging — which project should I file it under?" and offer a short list from `active_projects` (already in the session block). This is a single question, consistent with Tier 2 behavior, and prevents silent drop. Document this L1 capture escalation path explicitly in `references/capture-rules.md` as a "no-destination" failure mode resolution.

---

### Finding 4 — `read-hub.js` and `boot-context.py` parse hub sections with different extraction strategies, producing divergent blockers/questions data between status checks and boot context

**Area:** status  
**Severity:** P2

**Evidence:** `hooks/lib/boot-context.py` lines 206–224 parse the hub's "Open Questions & Blockers" using a Markdown table regex (`## Open Questions & Blockers\s*\n\|...`) and classify rows by `typ` field (cells[2]) as blockers or open_questions. `mcp-servers/cortex-vault/tools/read-hub.js` lines 44–65 use `extractSection(body, 'Open Questions')` and `extractSection(body, 'Blockers')` — these look for `## Open Questions` and `## Blockers` as *separate* headings, then filter for `- [ ]` checkbox lines within each. If the actual hub uses a combined `## Open Questions & Blockers` table (as specified by the update-context workflow), `read-hub.js` will return empty `open_questions: []` and `blockers: []` because neither `## Open Questions` nor `## Blockers` will match exactly. The boot-context parser handles the combined section; `read-hub.js` does not.

**Impact:** When `cortex-check-status` uses `read_hub` (its preferred MCP tool per SKILL.md lines 32–37), it gets empty blockers and open questions even when the hub has them. The status response says "no open blockers" incorrectly. For a designer checking if the Figma handoff blocker is cleared before pushing to dev, this is a trust-breaking wrong answer.

**Suggested fix:** Normalize `read-hub.js` to also match `## Open Questions & Blockers` as a combined heading (table-based format), consistent with how `boot-context.py` parses it. Add a test case in `tests/tools.test.js` for a hub with the combined section format.

---

### Finding 5 — Meeting threading requires exactly 3 prior instances; a designer with a new recurring series waits silently through 2 un-threaded meetings

**Area:** meeting  
**Severity:** P2

**Evidence:** `mcp-servers/cortex-vault/tools/thread-meeting.js` lines 194–200:
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
The threshold is hardcoded at 3. For the first two meetings in a series, `thread_meeting` returns a "Skipping" message. But the *confirmation line* the user sees in chat comes from `cortex-process-meeting`, which says "Meeting note filed." The underlying "Skipping" message from `thread_meeting` is the raw tool result — it may or may not be surfaced. Per `process-meeting/SKILL.md` line 80: "If it's the first meeting in a series, skip threading — just ensure it's in the MOC." This is handled at the workflow layer, but the tool itself returns a result that says "Skipping" even for the second meeting, which *should* be threadable to the first. A 2-meeting series should link meeting 2 → meeting 1 (Previous only, no Next yet). The threshold of 3 means meeting 2 is not threaded to meeting 1 at all.

**Impact:** A UX designer who has 2 weekly design critique sessions filed will have no `*Previous:*` link on meeting 2. When they open meeting 2 in Obsidian wanting to quickly navigate to last week's critique notes, they find no thread link. The navigation the threading feature promises doesn't exist for the first half of a new series.

**Suggested fix:** Lower the threshold to 2: if `effectiveGroup.length >= 2`, thread the new note to the prior one. The series-detection heuristic (3+ meetings share a title) exists in the SKILL.md, but the tool's job is just bidirectional linking — it doesn't need to enforce the series-detection threshold. The skill layer can decide whether to call the tool; the tool should thread whenever there's a prior note to link to.

---

### Finding 6 — `user-prompt-submit` hook has no pattern for natural design-status queries, leaving "what happened on X" and "what's new with X" unrouted

**Area:** status  
**Severity:** P2

**Evidence:** `hooks/user-prompt-submit` lines 147–155 (Step 3f) matches these status patterns:
```
*"status of"*|*"what's the status"*|*"where are we on"*|*"what's left on"*|*"what's blocking"*|*"any open questions"*
```
Natural UX-designer phrases like "what happened on [project] last week", "what's new with [project]", "what did we decide about [project]", "has anything changed on [project]", or "remind me where [project] stands" do not match any of these patterns. The hook fires `{}` (no hint). `cortex-check-status` is never hinted and may not be invoked. Additionally, "what did we decide about X" is a recall question that should route to `cortex-check-status` (reads the Changelog for decisions), but the trigger-phrases.md table (row 5) also doesn't include this phrasing. `recall_related` would be the fallback, but it requires the model to have already decided to call it — with no hint, the model answers from context rather than consulting the vault.

**Impact:** The most natural way a designer phrases a "catch me up" or "what was decided" question at the start of a work session does not trigger the status skill. The model answers from in-context memory (stale after a few days) rather than reading the hub and changelog. The designer gets an answer that diverges from the vault's actual recorded state.

**Suggested fix:** Extend the Step 3f pattern list in `hooks/user-prompt-submit` to include:
- `*"what happened"*` (with project name implied by context)
- `*"what's new with"*`
- `*"remind me where"*`
- `*"what did we decide"*`
- `*"catch me up"*`

Also add these to `references/trigger-phrases.md` row 5 so the two sources stay in sync.

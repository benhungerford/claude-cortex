---
audit_date: 2026-06-01
avatar_id: "18"
persona: Low-vision user relying on a screen reader — tests output verbosity, structure, and announcements
surface: Claude Desktop
---

# Avatar 18 — Daily-Use Audit (2026-06-01)

## Persona

**Name:** Alex (composite persona)
**Disability profile:** Low vision with significant central-field loss; uses VoiceOver on macOS with Claude Desktop. Relies exclusively on linearised text: no icons, no visual spatial cues, no table layout scanning. Font zoom is maxed. Copy-pasting from Claude Desktop is how Alex reviews and verifies everything Cortex writes.

**What Alex needs from Cortex:**
- Confirmation announcements that are complete sentences, not terse fragments, so VoiceOver reads them coherently
- Errors and warnings that are clearly labelled and not buried mid-paragraph
- Status responses that are sequentially structured (not table-heavy) so screen reader linearisation makes sense
- No silent operations — every vault write announced audibly through the chat surface
- Conflict and blocker warnings that are unmistakeable as warnings, not inline asides

---

## Day-in-the-Life Narrative

Alex opens Claude Desktop at 08:40 in a project repo directory (`~/Documents/Freelance Projects/fkt-checkout/`). The session-start hook fires, `boot-context.py` walks the cwd, matches the FKT registry entry, reads the hub, and injects a `<cortex-session>` block tagged L3. The `cortex-boot` skill runs on the first message.

**08:41 — Boot / L3 opening line.**
Alex's screen reader announces the L3 greeting: `FKT Shopify Website Build — Integrations stage. 2 open blockers. Ready.` That sentence is good — short, complete, VoiceOver-friendly. But the SKILL.md example at line 61–62 shows the greeting can expand to a multi-line list of blockers inline. In practice, when blockers contain punctuation (semicolons, em dashes from the registry), VoiceOver may parse the sentence oddly. Not a P0, but the delimiter choice matters.

**09:10 — Status check.**
Alex says: `"what's the status of FKT?"` The hook injects a `<cortex-hint>` for `cortex-check-status`. The skill fires, calls `mcp__cortex-vault__read_hub`, and returns a 3-5 sentence summary ending with `Sources: Project Context hub, Changelog (last 3 entries).` The `read_hub` tool returns a JSON blob (`read-hub.js` lines 107–117); the skill must prose-ify that JSON before presenting it. The JSON fields `open_questions` and `blockers` are raw arrays. If the model pastes those arrays verbatim, VoiceOver reads: `"open underscore questions colon open bracket waiting on stripe dot dot dot close bracket"` — incoherent.

**09:45 — Ambient recall fires.**
Alex starts describing a webhook debugging problem. `cortex-boot` SKILL.md (line 86) says: `"Surface relevant hits in one short line before answering."` The line format is: `Worth knowing: you've already documented this pattern in [[_MOC]] and [[ywPortal SSO]].` VoiceOver reads double-bracket wikilinks as literal text: `"left bracket left bracket M O C right bracket right bracket"`. For a sighted user the `[[...]]` is a visual shorthand; for Alex it is noise inserted before every link in every recall hit.

**10:30 — Meeting processing.**
Alex pastes a 45-line Granola transcript from a client call. The `user-prompt-submit` hook fires, pattern-matches on speaker labels (line 63–68), routes to `cortex-process-meeting`. The skill creates the meeting note, threads it, hands off decisions to `cortex-update-context`, updates the MOC, and announces.

The announcement pattern (SKILL.md line 135–136): `"Meeting note filed: 2026-04-08 FKT Standup. Threaded with last week's standup. Extracted 2 decisions to the hub + Changelog."` — this is a complete sentence. Good. But if the `thread_meeting` MCP tool returns an error (e.g., `thread-meeting.js` line 166: `"New file not found on disk"`) it returns a plain error string in a JSON `isError: true` block. The skill's failure-mode table (SKILL.md line 203) says "treat as first in series" for series-not-found but does not dictate how errors from the MCP tool itself are announced. Alex may hear the raw JSON error string read by VoiceOver.

**11:15 — Conflict detection fires.**
Alex types: `"we're going with Stripe for everything, drop Braintree."` `cortex-update-context` reads the Tech Stack sub-note, finds `Braintree`, and must surface the Conflict Rule (SKILL.md line 78–86). The mandated format is:

> `CONFLICT DETECTED: the new decision to use Stripe contradicts the existing Tech Stack note which lists Braintree. How would you like to resolve this?`

This is all-caps label + inline colon — strong semantic signal for screen readers. VoiceOver will announce "CONFLICT DETECTED" with emphasis. This is the one place the UX is genuinely screen-reader-friendly by accident.

**14:00 — Recall search with low scores.**
Alex asks about a vendor quirk. `recall_related` runs, embeds the query (`embeddings.js` lines 19–27), runs the sqlite-vec ANN query (`recall-related.js` lines 68–75), scores results as `1 - distance/2` (line 81). If no results clear `score > 0.5`, the skill says nothing (SKILL.md line 87). That silence is correct behavior, but if embeddings have never been indexed (fresh vault, no `cortex-index` run), the `vec_notes` virtual table is empty and the tool silently returns `count: 0`. Alex has no way to know whether silence means "no relevant notes" or "search index is empty." The distinction matters: one is expected, the other is a setup gap.

**16:30 — Tier 1 capture confirmation.**
A scope decision is made in conversation. `cortex-update-context` fires via ambient capture, writes to the hub and Changelog, and announces `"Updated FKT: wholesale portal moved out of scope (phase 2). Logged."` This is a terse fragment. VoiceOver reads it fine (it is a grammatical sentence). But `capture-rules.md` line 76 says batched captures produce: `"Updated <Project>: logged the nav decision, cleared the Figma blocker, added a new client preference."` — three comma-separated items. VoiceOver reads them linearly but the structure is ambiguous: is "cleared the Figma blocker" one action, or does it bleed into "added"? A numbered list would be unambiguously sequential.

**17:00 — Session stop.**
The `stop` hook fires (`hooks/stop` lines 47–97). It appends pending signals to `_signals.log` and pending memory entries to `memory.md`. The only output is `<cortex-memory>Flushed N pending memory update(s) to vault memory.md.</cortex-memory>` in the `additionalContext`. That tag wrapping is invisible in Claude Desktop's rendered output — the user never sees or hears this confirmation. For Alex, the memory flush is entirely silent.

---

## Findings

### Finding 1 — Wikilink syntax read aloud as literal bracket noise in recall and capture confirmations

**Area:** recall  
**Severity:** P1  
**Evidence:** `skills/cortex-boot/SKILL.md` line 86: `Worth knowing: you've already documented this pattern in [[_MOC]] and [[ywPortal SSO]].`; `references/vault-conventions.md` lines 44–47 mandates `[[wikilinks]]` in all footers and recall surfaces. The `extractWhy` function in `mcp-servers/cortex-vault/tools/recall-related.js` lines 18–38 produces terms from title/headings but the surface layer (SKILL.md example at line 86) templates the `[[...]]` syntax directly into the chat response.  
**Impact:** VoiceOver reads `"left bracket left bracket M O C right bracket right bracket"` for every wikilink surfaced in recall hits and capture confirmations. A user with 50+ notes generates multiple such announcements per session. The double-bracket syntax is an Obsidian UI affordance that is meaningless (and actively harmful) in linearised text.  
**Suggested fix:** In `cortex-boot` SKILL.md and wherever recall results are surfaced, strip `[[...]]` to plain note title text before presenting to the user: `Worth knowing: you've already documented this pattern in _MOC and ywPortal SSO.` Add a formatting note to `references/vault-conventions.md`: "When surfacing wikilinks in chat responses, render as plain text title only, not as `[[Title]]`."

---

### Finding 2 — `read_hub` returns raw JSON arrays; prose conversion is unspecified, creating screen-reader-hostile output risk

**Area:** status  
**Severity:** P1  
**Evidence:** `mcp-servers/cortex-vault/tools/read-hub.js` lines 107–117: the `read_hub` handler returns a JSON object with `open_questions: string[]` and `blockers: string[]`. `skills/cortex-check-status/SKILL.md` lines 42–44 says "prefer `mcp__cortex-vault__read_hub`" but nowhere specifies how to serialise the array fields into prose for the chat response. The worked example (SKILL.md lines 71–84) shows the model producing a summary sentence — but there is no instruction to transform the JSON before speaking it. If a model implementation pastes the JSON blob or reads array entries as comma-joined raw strings, VoiceOver announces the syntactic structure, not the content.  
**Impact:** Inconsistent model behaviour under the existing spec produces `open_questions: ["Waiting on Stripe..."]` read aloud as typed characters. This affects every `cortex-check-status` invocation for a screen-reader user.  
**Suggested fix:** In `skills/cortex-check-status/SKILL.md`, add an explicit instruction: "Do not output JSON from `read_hub` directly. Prose-ify every field: render `blockers` as a numbered or bulleted sentence list, render `open_questions` as a separate paragraph." Mirror this constraint in `skills/cortex-update-context/SKILL.md` which also calls `read_hub` on conflict checks.

---

### Finding 3 — Batched capture confirmation is a comma-list sentence; numbered structure would be unambiguous for screen readers

**Area:** capture  
**Severity:** P2  
**Evidence:** `references/capture-rules.md` lines 73–75: the mandated batch confirmation format is `"Updated <Project>: logged the nav decision, cleared the Figma blocker, added a new client preference."` — one compound sentence with comma-separated actions. No structured list alternative is defined.  
**Impact:** VoiceOver reads comma lists without pause emphasis, making three distinct vault writes sound like a single run-on announcement. A low-vision user cannot count how many things were written or easily re-listen to identify a specific action from the batch. The risk is higher when 4–5 captures batch together (e.g., after a meeting extraction plus ambient captures).  
**Suggested fix:** In `capture-rules.md`, change the batch confirmation format to a numbered inline list, or alternatively a short sentence followed by bullets: `"Updated FKT — 3 changes: (1) nav decision logged, (2) Figma blocker cleared, (3) client preference added."` Numbered items give VoiceOver a predictable read-order.

---

### Finding 4 — Silent memory flush at session stop; no chat-visible confirmation for screen-reader users

**Area:** boot  
**Severity:** P2  
**Evidence:** `hooks/stop` lines 192–205: the only output is `<cortex-memory>Flushed N pending memory update(s) to vault memory.md.</cortex-memory>` wrapped in `additionalContext`. In Claude Desktop, `additionalContext` from a Stop hook is not surfaced as a visible chat message; it is injected as context for the next session, not announced to the user in the current one. The hook exits silently from the user's perspective.  
**Impact:** Alex cannot know that memory was persisted. If the flush fails (e.g., disk full, permissions), the error in `hooks/stop` line 170 sets `FLUSH_RESULT="0"` and the hook exits with `printf '{}\n'` — no announcement to the user at all. For a screen-reader user who cannot glance at system indicators, silent data operations are invisible failures.  
**Suggested fix:** Output a brief visible chat message on session stop: `"Session ended — memory flushed (N updates)."` For flush failures, output an error message in the chat context: `"Warning: memory flush failed. N updates may not have been saved."` This requires the Stop hook to use a `message` output field rather than only `additionalContext`, or — more practically — a pre-stop confirmation model turn.

---

### Finding 5 — Empty semantic search index is indistinguishable from "no relevant notes" for the user

**Area:** search  
**Severity:** P2  
**Evidence:** `mcp-servers/cortex-vault/tools/recall-related.js` lines 60–84: the handler embeds the query, runs the ANN query against `vec_notes`, and returns results. If `vec_notes` is empty (index never built), `db.prepare(...)..all(vector, fetchK)` returns `[]`. The handler returns `{"count": 0, "results": []}`. `cortex-boot` SKILL.md line 87 says: "If no results clear the threshold, say nothing about the recall." The model says nothing.  
**Impact:** A user who has never run `cortex-index` sees identical silence to a user with a healthy index that found no matches. Alex has no feedback mechanism. The distinction is critical: "no index" means all contextual recall is disabled, which is a setup failure, not an expected outcome.  
**Suggested fix:** Add a check in `recall-related.js`: if the result count is zero, query `SELECT count(*) FROM notes` to distinguish "empty index" from "no matches". Return a field `index_empty: true` when the notes table is empty. In `cortex-boot` SKILL.md, add a rule: "If `recall_related` returns `index_empty: true`, surface once per session: `Note: your vault search index is empty — run /cortex-index to enable recall.`"

---

### Finding 6 — MCP tool error strings are raw and unannounced; no formatting guidance for screen-reader-safe error surfacing

**Area:** mcp  
**Severity:** P2  
**Evidence:** `mcp-servers/cortex-vault/server.js` lines 56–63: on tool errors, the server returns `{content: [{type: 'text', text: 'Error in <name>: <err.message>'}], isError: true}`. Individual tools return their own error strings: `thread-meeting.js` line 166: `"New file not found on disk: ..."`, `read-hub.js` line 91: `"No Project Context file found in: ..."`, `recall-related.js` line 46: `"context is required (non-empty string)"`. These are machine-formatted strings prefixed with the tool name, not user-facing sentences. No skill spec defines how to surface an MCP `isError: true` response to the user.  
**Impact:** When a tool fails mid-skill execution (e.g., threading fails, hub read fails), the model may either pass the raw error string to the user or silently continue (skill-spec-dependent). For Alex, a raw error like `"Error in thread_meeting: New file not found on disk: 2026-06-01 FKT Standup.md"` is read by VoiceOver as a single long technical string with no labelling as an error, no guidance on what to do, and no distinction from a normal confirmation.  
**Suggested fix:** Add a standard error-surfacing rule to `references/capture-rules.md` and the cortex-boot SKILL.md: "When any MCP tool returns `isError: true`, the model must reformat the error as a labelled user message before presenting it: `Error: <plain-English description of what failed and what the user can do>. (Technical detail: <raw message>.)` Never pass raw tool error strings to the user."

---

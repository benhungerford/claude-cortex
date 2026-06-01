---
avatar: "09"
persona: "B2B Sales Rep — 15 Active Deals"
surface: "Claude Desktop"
audit_date: "2026-06-01"
auditor: "claude-sonnet-4-6 (subagent)"
---

# Avatar 09 — B2B Sales Rep: Daily Deal-Logging Loop

## Persona

**Name:** Alex Chen (composite)
**Role:** B2B SaaS account executive
**Daily rhythm:** 5–8 prospect/client calls per day across 15 active deals. After each call, logs next steps, notes, and decisions. Checks deal status before calls to avoid looking unprepared. Uses Granola to record calls. Opens Claude Desktop from a non-repo directory (home folder or Downloads) — never from a code project.

---

## Day Narrative

**8:45 AM — Morning prep session.** Alex opens Claude Desktop to review what's happening across their pipeline before a 9 AM discovery call with Meridian Corp. Claude Desktop boots. The `session-start` hook fires, Python runs `boot-context.py`, and the `<cortex-session>` block is injected. `cortex-boot` reads `Level: L1 — Passive` because Alex's CWD is `~/Documents` — outside the vault, outside any registered repo. There is no L3 opening line, no deal summary, no "here are your open blockers today." Alex sees a blank chat box. They type: "what are my open deals with the most recent activity?" `cortex-check-status` fires but returns "Two matches: 1. Meridian Corp... which one?" — because the skill is single-project. Alex wanted a pipeline view and got a disambiguation prompt. They pick Meridian. Status reads back the hub, surfaces 2 blockers: "security review approval" and "IT director demo still needed." Useful, but they had to ask project-by-project.

**9:30 AM — Post-discovery call.** Alex pastes their structured call notes into Claude. The notes are 28 lines but use bullet-point headings ("Key Discussion Points:", "Next Steps:", "Objections:") with only 2 "Name: text" pattern lines. The `user-prompt-submit` hook runs the transcript detector: 28 lines pass (≥ 20) but SPEAKER_COUNT = 2, failing the ≥ 3 threshold. `cortex-process-meeting` does NOT auto-trigger. Alex's notes just sit there. No hint fires. Alex has to manually type "process this meeting" to get the skill to engage. One extra step — but it happens after every call that uses structured notes rather than raw transcript format.

**10:15 AM — Logging a next step.** After the call, Alex says: "my next step on Meridian is to send the security review questionnaire by Friday." This is the most important thing they need to track. `user-prompt-submit` scans for triggers: no "log that," no "we decided," no "blocker." Nothing fires. `cortex-boot`'s ambient capture watch scans for Tier 1 signals: decisions, new blockers, meeting transcripts, client preferences, reusable patterns. "My next step is to send X" does not match any Tier 1 category in `capture-rules.md`. The action item evaporates. Alex would have to explicitly say "blocker: security questionnaire not sent" or "log this: send Meridian security questionnaire by Friday" to force a capture. In natural speech, they say neither.

**11:00 AM — Logging a blocker resolution.** Their champion at Techco emails to say the legal review is complete. Alex tells Claude: "we got the legal sign-off from Techco." Per `references/trigger-phrases.md` row 9, "we got <X>" is a documented blocker-resolved trigger. But `hooks/user-prompt-submit` line 105 only implements three patterns: "that's resolved," "blocker resolved," "unblocked." "We got the legal sign-off" does not match any of them. No `cortex-hint` fires. `cortex-update-context` is not invoked. The blocker stays open in the Techco hub. Alex has no idea.

**12:30 PM — Quick status before a renewal call.** "What's the status of BetaCorp?" `cortex-check-status` calls `mcp__cortex-vault__read_hub`. `read_hub` calls `extractOpenQuestions(body)` looking for `## Open Questions` and `extractBlockers(body)` looking for `## Blockers` — both as separate sections. But BetaCorp's hub was scaffolded from `assets/blank-template.md` which uses a combined `## Open Questions & Blockers` table format (line 70). Neither separate heading exists. `read_hub` returns `open_questions: []` and `blockers: []`. Alex is told there are no open blockers — but there are two. They go into the renewal call underprepared and get blindsided.

**2:00 PM — Processing a Fathom transcript.** Alex's Granola integration returns a 200-line transcript from their 1:30 PM demo with SalesOps Inc. The `user-prompt-submit` transcript detector fires correctly (200 lines, many speaker labels). `cortex-process-meeting` engages. It files the meeting note, threads with the prior SalesOps demo, and extracts 3 decisions. During this, `recall_related` fires with context "SalesOps Inc demo — pricing, timeline, enterprise contract terms." The vault has 15 active deals, all in the same B2B sales domain. All 15 deal hubs and ~40 meeting notes have cosine similarity > 0 with "enterprise contract terms." The threshold `score > 0.5` maps to `distance < 1.0` which in normalized cosine space means any positive similarity passes. Alex gets told: "Worth knowing: you've documented related patterns in [[BetaCorp Proposal]], [[Techco Demo Notes]], [[Meridian Discovery Call]]." These are about different companies at different deal stages — noise, not signal.

**4:30 PM — Pipeline review.** Alex asks: "give me a summary of all 15 active deals and where we are." `cortex-check-status` is single-project only. No pipeline aggregation skill exists. The workflow escalation table in `activation-levels.md` does not include a path to L3 for "reviewing the whole pipeline." Alex has to ask about each deal individually. At 15 deals, this is impractical mid-day.

**5:00 PM — Session end.** Claude stops. The `stop` hook fires and checks `$PLUGIN_DATA/session-cache/pending-memory.json`. No skill or MCP tool in the codebase writes to `pending-memory.json` — the file either doesn't exist or is empty. The flush is a no-op. Any preferences Alex mentioned ("Meridian prefers async email over calls," "Techco's champion is Sarah not Bob") that weren't explicitly captured are lost. The stop hook silently exits.

---

## Findings

### Finding 1 — Action items are never captured as vault artifacts

**Severity:** P1

**Area:** capture

**Evidence:** `references/capture-rules.md` — Tier 1 signals: scope/strategy decisions, blockers, meeting transcripts, client preferences, reusable patterns. No "action item" or "next step" signal type exists anywhere in the file. `skills/cortex-process-meeting/SKILL.md:217` explicitly states: "Does not interpret action items into follow-ups or reminders — lists them in the meeting note only." `workflows/update-context.md` routing table has 8 change types; none is "action item" or "next step." `skills/cortex-update-context/SKILL.md:60-68` routing table: same gap.

**Impact:** For a B2B sales rep, the most critical daily output of every call is "what do I do next on this deal?" Next steps don't fit the decision/blocker/preference model. They evaporate from every session unless the rep explicitly uses "blocker:" framing, which distorts their pipeline state. Across 15 deals × 3 calls/week each, dozens of next steps per week are lost.

**Suggested fix:** Add "action item" / "next step" as a Tier 1 capture signal in `capture-rules.md`. Route to the project hub's `Open Questions` section as a `- [ ]` task (distinct from blockers by a Type column value like "Task"). Add trigger phrases "my next step is", "I need to", "action item:", "follow up" to `references/trigger-phrases.md` row 9a and implement in `hooks/user-prompt-submit`. The `open_question` MCP tool's `add` action already writes `- [ ]` items — it just needs a path from the capture layer.

---

### Finding 2 — "we got X" blocker-resolved trigger documented but not implemented

**Severity:** P1

**Area:** capture

**Evidence:** `references/trigger-phrases.md:29` — row 9 explicitly lists `"we got <X>" (where X is a previously-logged blocker)` as a literal trigger for `cortex-update-context`. `hooks/user-prompt-submit:105` — the resolved-trigger `case` block only implements three patterns: `"that's resolved"`, `"blocker resolved"`, `"unblocked"`. The phrase `"we got"` does not appear anywhere in `hooks/user-prompt-submit`. The spec-to-implementation gap is exact and verified.

**Impact:** Sales reps rarely say "blocker resolved." They say "we got the PO," "we got sign-off," "we got the contract." This is the most common natural-language way to resolve a sales-cycle blocker. Every such utterance silently fails to trigger a vault update. Blockers accumulate as stale open items. Status checks report false positives ("Techco legal review still blocking" when it's been resolved for a week).

**Suggested fix:** Add `*"we got "* ` to the resolved-trigger `case` block in `hooks/user-prompt-submit:105`. Because "we got" is ambiguous (not all "we got" statements resolve blockers), tag it with `CONFIDENCE="medium"` and route it to `cortex-update-context` which already has the conflict-checking logic to handle false positives gracefully. One-line change: add `|*"we got "*)` to the existing `case` block.

---

### Finding 3 — read_hub returns empty blockers for all standard-template hubs (section name mismatch)

**Severity:** P0

**Area:** status

**Evidence:** `mcp-servers/cortex-vault/tools/read-hub.js:44-62` — `extractOpenQuestions` looks for `## Open Questions` and `extractBlockers` looks for `## Blockers` as separate section headings. `assets/blank-template.md:70` — the canonical hub template uses a single combined `## Open Questions & Blockers` table. `hooks/lib/boot-context.py:207` — the boot parser correctly targets `## Open Questions & Blockers` with a regex. Result: `read_hub` returns `open_questions: []` and `blockers: []` for every hub created from the standard template. This has been independently documented by avatars 03, 05, and 08 — confirming it is systemic.

**Impact:** For the sales rep, every pre-call status check via `cortex-check-status` → `read_hub` returns "no open blockers" even when blockers exist. The rep walks into calls without knowing outstanding issues. This is the most dangerous failure mode for the persona: false confidence before a negotiation.

**Suggested fix:** In `read-hub.js`, update `extractOpenQuestions` and `extractBlockers` to also match `## Open Questions & Blockers` as a combined section, then parse the table rows classifying by a Type column (matching `boot-context.py:206-224` logic). Alternatively, add a pre-pass that detects whether the hub uses combined or separate sections and routes accordingly. Add a fixture for combined-section hubs in `mcp-servers/cortex-vault/tests/`.

---

### Finding 4 — Structured sales notes (non-speaker-label format) miss auto-routing to process-meeting

**Severity:** P2

**Area:** capture

**Evidence:** `hooks/user-prompt-submit:60-70` — transcript detection requires `LINE_COUNT >= 20` AND `SPEAKER_COUNT >= 3` where SPEAKER_COUNT is `grep -cE '^[A-Za-z]+: '`. Verified empirically: a 28-line structured sales note with sections "Key Discussion Points:", "Next Steps:", "Objections:" has SPEAKER_COUNT = 2 and fails the threshold, so `cortex-process-meeting` is not hinted. The explicit meeting trigger phrases at lines 73-80 (`"process this meeting"`, `"meeting notes:"`, `"from my call with"`, `"here are the notes from"`) are the only fallback — but only if the user knows to type them. `references/trigger-phrases.md:12` — the structural signal specifies "multi-line, Speaker: text format" which is Fathom/Granola export format, not a sales rep's own note format.

**Impact:** Sales reps who take their own structured notes (the majority, at least for quick calls) get no auto-routing. After every non-Fathom call they must type a magic phrase to file notes. This adds friction 5–8 times per day and breaks the "invisible" capture promise.

**Suggested fix:** Add a second structural heuristic: `LINE_COUNT >= 15` AND note contains section headers starting with `##` or keywords like "Next Steps", "Action Items", "Decision", "Participants". Route to `cortex-process-meeting` with `CONFIDENCE="medium"` (so the model can sanity-check before filing). This covers the structured-notes format without conflating it with project briefs (which are covered by the `cortex-ingest-project` heuristic at row 11).

---

### Finding 5 — Ambient recall score threshold (> 0.5) passes near-universal matches in same-domain vaults

**Severity:** P2

**Area:** recall

**Evidence:** `skills/cortex-boot/SKILL.md:85` — threshold is `score > 0.5`. `mcp-servers/cortex-vault/tools/recall-related.js:81` — score computed as `1 - r.distance / 2`. In sqlite-vec with cosine distance, `distance` ranges [0, 2] where 0 = identical. `score > 0.5` means `distance < 1.0` which means `cosine_similarity > 0`. For normalized vectors, cosine similarity between any two documents in the same business domain (sales notes, prospect hubs, deal stages) will almost always be > 0. A vault with 15 active deals — all using similar vocabulary ("proposal," "timeline," "contract," "demo," "decision maker") — will have nearly every note clearing the 0.5 threshold when querying on deal-specific context.

**Impact:** When the sales rep prepares for an Acme call, recall surfaces 5 notes — but 3 of them are from other deals (BetaCorp, Techco, SalesOps) with vaguely similar language. The "Worth knowing" line becomes noise the rep learns to ignore. Once ignored, legitimate recall (e.g., a past conversation with the same contact at a different company) is also missed. Ambient recall degrades from a feature to a distraction.

**Suggested fix:** Raise the threshold from `> 0.5` to `>= 0.7` in `skills/cortex-boot/SKILL.md` (behavioral instruction) and optionally enforce it in `recall-related.js:81` as a hard filter before results are returned. Score 0.7 corresponds to cosine similarity ~0.6 — meaningfully related, not just same-domain. Additionally, the `why` field in recall results (extracted from heading keywords) could be exposed so the model can filter out cross-deal noise before surfacing the "Worth knowing" line.

---

### Finding 6 — pending-memory.json write path is architecturally orphaned; memory flush is a no-op

**Severity:** P2

**Area:** capture

**Evidence:** `hooks/stop:101-170` — reads `$PLUGIN_DATA/session-cache/pending-memory.json` and appends its contents to `memory.md`. `tests/run-hook-tests.sh:162` — the only place in the codebase that writes to `pending-memory.json` is the test fixture. No skill (`skills/*/SKILL.md`), no MCP tool (`mcp-servers/cortex-vault/tools/*.js`), and no workflow (`workflows/*.md`) contains instructions or code that writes to `pending-memory.json`. The stop hook's flush is only reachable if Claude independently decides to write to that file path, which is undocumented behavior.

**Impact:** The memory accumulation system — designed to carry facts like "Meridian's champion is Sarah Chen," "BetaCorp's IT director signs off on all security decisions" — silently never fires. Each new session boots without retained preferences or contact-level intelligence. For a sales rep with 15 relationships to track, this erases the primary value of long-term memory. The 100-line cap on `memory.md` at boot (`boot-context.py:45`) adds insult: even if memory were being written, the tail-cap means old entries would be evicted.

**Suggested fix:** Create a `mcp__cortex-vault__queue_memory` tool (or add an `action: "queue"` to an existing tool) that appends an entry to `pending-memory.json`. Document in `capture-rules.md` that client preference captures (Tier 1: "Client or collaborator preference stated") should use `queue_memory` rather than a direct vault write for session-ephemeral facts. Update `skills/cortex-update-context/SKILL.md` to call `queue_memory` for the "client preference" change type when the user is at L1 or L2. This gives the stop hook a real write path and makes memory accumulation reliable.

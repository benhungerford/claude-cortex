---
avatar: 11
persona: Nonprofit Program Manager — Grant Tracking & Funder Relations
surface: Claude Desktop
audit_date: 2026-06-01
auditor: claude-sonnet-4-6 (subagent)
---

# Avatar 11 — Daily-Use Audit: Nonprofit Program Manager

## Persona

**Role:** Nonprofit program manager responsible for tracking 8–12 active grant cycles, monitoring funder reporting deadlines, and managing commitments to multiple foundation and government funders simultaneously.

**Vault use pattern:** Vault contains one folder per funder (e.g. `Work/Grants/MacArthur Foundation/Community Health Initiative/`) with hub files tracking grant status, reporting deadlines, and award conditions. Recurring meetings include quarterly program officer check-ins, internal grant review calls, and board update sessions. Claude Desktop is open all day; sessions are started from the home directory (`~/`), not from inside the vault or a registered repo.

**Pain sensitivity:** Deadline misses are catastrophic. Funder relationship data must be accurate. Over-capture of exploratory chat into official grant notes would be a trust/compliance risk.

---

## Simulated Day-in-the-Life

**8:45 AM — Session opens from `~/Documents/`**

Boot fires. cwd is `~/Documents/` — not inside the vault, no registry match. `boot-context.py` correctly computes L1. The session block carries personality, memory, and the last 15 lines of `_changelog.txt`. Cortex is silent. The user types: *"Morning — what's the status of the MacArthur grant?"*

The `user-prompt-submit` hook matches `*"what's the status"*` (line 149 of `hooks/user-prompt-submit`) and injects `cortex-check-status` hint. The skill fires, reads the hub file, returns stage and blockers.

But here is where the first failure surfaces: the hub file for this project was scaffolded via `scaffold_project` MCP tool, which creates hub files with `## Open Questions`, `## Blockers`, and `## Key Decisions` sections using `- [ ]` checkbox syntax (`scaffold-project.js` lines 177–184). However, `boot-context.py`'s `parse_hub()` function (lines 205–224) only searches for a section named `## Open Questions & Blockers` in a pipe-delimited *table* format matching the `blank-template.md` layout. The two hub schemas are incompatible. L3 sessions for this user will show zero blockers at boot even when real blockers exist, and `cortex-check-status` reads the correct hub format via `read-hub.js` (which uses `extractBlockers` on `- [ ]` items), so the user sees blockers in check-status but not in the L3 boot greeting.

**9:30 AM — Funder call ends. User pastes Granola transcript.**

Structural transcript trigger fires correctly (user-prompt-submit line 63: 20+ lines + 3+ speaker labels). `cortex-process-meeting` routes to `Notes/` since primary subject is a grant deliverable.

The skill hands off blocker resolution to `cortex-update-context`, which calls `open_question` MCP tool. The tool's `resolveQuestionInBody()` (open-question.js line 66) marks items as `- [x] ... — Resolved: ...` (strikethrough-style). However, `cortex-update-context` SKILL.md (line 92) explicitly states: "Remove the row from the Open Questions table entirely. Do not use strikethrough." The MCP tool directly contradicts the skill contract. Resolved blockers accumulate as struck-through clutter in the grant hub — a persistent source of confusion for a user who relies on that section for compliance tracking.

**11:15 AM — User says: "We got confirmation the interim report is accepted — that blocker is cleared."**

`user-prompt-submit` hook checks for `*"that's resolved"*|*"blocker resolved"*|*"unblocked"*` (line 105). This phrase matches none of those patterns. "blocker is cleared" does not trigger anything. The user is at L1 (cwd not in vault, project mentioned but no L3 escalation occurred this session since no repo registration for grant folders). The ambient Tier 1 capture rule in `capture-rules.md` would ideally fire, but without an L2/L3 escalation and without an explicit trigger phrase, there is no hook or code path that intercepts this statement. The blocker is never cleared from the hub.

**2:00 PM — User asks: "find my notes on restricted vs unrestricted funding from last year"**

No literal trigger matches this in `user-prompt-submit`. Cortex answers with a `search_vault` call via ambient recall from `cortex-boot` Step 6 (SKILL.md line 71). This works IF the semantic index is current. The index is updated post-tool-use for files written by the Write/Edit/Obsidian MCP tools (post-tool-use hook, step 8b). But if the user has been writing notes directly in Obsidian (bypassing Claude entirely), those files are not re-indexed until the user explicitly runs `/cortex-index`. There is no session-start re-index trigger. A grant manager who does most of her writing in Obsidian will find recall returning stale or absent results — the system looks smart but is quietly wrong.

**4:30 PM — User scaffolds a new grant: "new project — Kresge Foundation, Digital Equity Grant"**

`user-prompt-submit` hook line 116 matches `*"new project"*`. `cortex-ingest-project` skill fires. The workflow asks clarifying questions including an emoji (ingest-project.md step 3). The emoji-picker is charming for a web agency; for a grant manager logging a $500K award, it is noise that adds a round-trip before the critical grant details are captured. The workflow also asks "Does this project have a code repo I should link?" (step 4.5) — deeply irrelevant for every grant project. These friction points accumulate across every new funder tracked.

Then: `scaffold_project` MCP tool (scaffold-project.js lines 284–288) enforces `category: enum ['Personal', 'TBL']`. A nonprofit user whose vault has a `Work/Grants/` or `Work/Programs/` bucket cannot scaffold projects into their natural vault location. The enum is hardcoded to Ben Hungerford's taxonomy. The user's vault personality.md likely uses a different `bucket_term`, but `scaffold_project` ignores personality.md entirely — the path is hardcoded as `Work/${category}/${client}/${project}`.

**End of day — session closes, stop hook fires**

Stop hook checks for `pending-memory.json`. Anything written to `memory.md` via the session gets flushed. The grant manager's grant decisions, funder preferences, and deadline updates all live in project hubs — memory.md is not where they go. This is fine. But the session's Tier 1 ambient capture events that never fired (the "interim report accepted" from 11:15 AM) are silently dropped — no recovery mechanism exists after session end.

---

## Findings

### Finding 1 — Hub format mismatch: boot-context.py reads table schema, scaffold_project writes checkbox schema (P0)

**Area:** boot

**Evidence:** `hooks/lib/boot-context.py` lines 205–224 — `parse_hub()` searches for `## Open Questions & Blockers` with a pipe-delimited table (5 columns). `mcp-servers/cortex-vault/tools/scaffold-project.js` lines 177–184 scaffolds hub files with `## Open Questions`, `## Blockers`, and `## Key Decisions` as freeform `- [ ]` checkbox lists, no table. `assets/blank-template.md` uses the table format but `scaffold_project` does not use `blank-template.md` at all.

**Impact:** Every project scaffolded via the `scaffold_project` MCP tool (the primary automated path) produces a hub that `boot-context.py` cannot parse for blockers or open questions. L3 boot greeting always shows zero blockers. For a grant manager who relies on the boot greeting to surface "3 open blockers" at session start, critical deadline dependencies and compliance holds are invisible at boot for every project.

**Suggested fix:** Align `scaffold_project` to produce the table-format `## Open Questions & Blockers` section matching `blank-template.md`, or rewrite `parse_hub()` to handle both `- [ ]` checkbox lists and pipe-delimited tables.

---

### Finding 2 — open_question MCP tool leaves resolved items as `- [x]` strikethrough; skill contract requires full removal (P1)

**Area:** capture

**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js` line 76: `lines[matchIdx] = \`- [x] ${originalText} — Resolved: ${resolution}\`` (marks resolved with strikethrough). `skills/cortex-update-context/SKILL.md` lines 88–97 explicitly states: "Remove the row from the Open Questions table entirely. Do not use strikethrough. Do not mark it 'resolved' in-place." The two are in direct contradiction.

**Impact:** Resolved grant blockers accumulate in the Open Questions section as struck-through items. The hub becomes progressively harder to scan. A grant manager checking "what's open on the MacArthur grant" will see a growing list of strikethrough items mixed with real open items. `read-hub.js` (line 54) also filters on `- [ ]` only, so a correctly resolved item would disappear from `read_hub` results — but it still clutters the file for anyone reading in Obsidian. The experience is confused and untidy.

**Suggested fix:** In `open_question.js` `resolveQuestionInBody()`, remove the matching line entirely (splice it out) instead of replacing with `- [x]`. Log the original text in the changelog entry for auditability.

---

### Finding 3 — Implicit blocker resolution ("that blocker is cleared") never triggers capture at L1/L2 (P1)

**Area:** capture

**Evidence:** `hooks/user-prompt-submit` lines 104–110 checks for exact phrases: `*"that's resolved"*`, `*"blocker resolved"*`, `*"unblocked"*`. Natural language like "that blocker is cleared", "we got final sign-off", "the reporting hold is lifted", "funder confirmed acceptance" — all common in grant management — match none of these patterns. `references/capture-rules.md` lines 27–29 defines Tier 1 as "blocker resolved → Remove row from Open Questions + log resolution in Changelog" but there is no ambient code path that actually fires at L1 or L2 when an unrecognized phrasing occurs. The `cortex-boot` SKILL.md Step 6 describes `recall_related`, not capture. Ambient Tier 1 capture is described as a model-side behavior with no hook enforcement.

**Impact:** A grant manager who says "MacArthur confirmed — the interim report is accepted, we can move to the final budget" gets no capture. Critical compliance events go unlogged. After session end, the blocker remains open in the hub indefinitely. For grant tracking, where regulatory compliance depends on accurate state, this is a recurring daily failure.

**Suggested fix:** Add natural-language blocker resolution patterns to the `user-prompt-submit` hook: `*"cleared"*`, `*"accepted"*`, `*"signed off"*`, `*"approved"*`, `*"confirmed"*` combined with a blocker-context signal. Alternatively, document explicitly that Tier 1 ambient capture is *not* hook-enforced and relies entirely on the model — so users know to use explicit trigger phrases.

---

### Finding 4 — Semantic search (recall_related, search_vault) silently returns stale results if user writes in Obsidian directly (P1)

**Area:** search

**Evidence:** `hooks/post-tool-use` lines 196–209: re-indexing is triggered only when a Write/Edit/mcp__obsidian__ tool fires within a Claude session. `mcp-servers/cortex-vault/lib/indexer.js` has no file-watcher or cron mechanism. Session-start hook does not trigger re-indexing. If a grant manager writes meeting notes, funder updates, or award conditions directly in Obsidian (bypassing Claude entirely), those changes never reach the SQLite vec_notes table until a manual `/cortex-index` run. `recall_related` (recall-related.js line 62) queries the stale DB.

**Impact:** Ambient recall silently returns outdated results. When the user asks "find prior notes on restricted funding", Cortex may surface notes from 6 months ago while ignoring the fresh funder context written last week in Obsidian. The system appears to be working (it returns results with scores) but returns the wrong information. In grant management, where funder relationship history determines what's fundable, stale recall is worse than no recall because the user trusts it.

**Suggested fix:** At session-start, if the vault's `_changelog.txt` mtime is newer than the search DB's `updated` timestamp on the most recent indexed note, emit a one-line notice: "Vault has changes since last index — run /cortex-index for current recall." Or add a lightweight incremental re-index of files modified in the last 24h at session boot (constrained to a short timeout, e.g. 3 seconds).

---

### Finding 5 — scaffold_project category enum is hardcoded to Ben's taxonomy; non-TBL/Personal vaults cannot scaffold projects (P1)

**Area:** onboarding-gap

**Evidence:** `mcp-servers/cortex-vault/tools/scaffold-project.js` line 286: `enum: ['Personal', 'TBL']`. Lines 71–81: all paths are hardcoded as `Work/Personal/...` or `Work/TBL/...`. The tool ignores `personality.md`'s `bucket_term` and `buckets` entirely. A nonprofit user whose vault uses `Work/Grants/`, `Work/Programs/`, or `Work/Clients/` as their bucket_term will have all scaffolded projects placed in the wrong directory tree.

**Impact:** Every scaffolded project lands in the wrong folder. The MOC, hub, and meeting files are structurally correct but vault-locationally wrong — they won't appear in the user's Obsidian navigation under the expected path, and `read_hub` calls will use the scaffolded path while the user's actual notes may be in a different tree. For a grant manager tracking 10+ funders, this is a persistent disorientation.

**Suggested fix:** Read `personality.md` in `scaffold_project` to discover `bucket_term` and valid buckets before building paths. Accept a freeform `category` string (validated against personality buckets) instead of the hardcoded enum. This makes the tool persona-agnostic.

---

### Finding 6 — ingest-project workflow requires emoji pick and repo-link prompt for every new grant; irrelevant friction for non-dev personas (P2)

**Area:** ux

**Evidence:** `workflows/ingest-project.md` Step 3 (lines 28–41): mandatory emoji selection before the context doc is created. Step 4.5 (lines 116–122): asks "Does this project have a code repo I should link?" for every new project. Both steps require a user response before the scaffold proceeds, adding 1–2 unnecessary round-trips for any persona that isn't a developer.

**Impact:** A grant manager scaffolding a new funder grant must answer "pick an emoji" and "is there a code repo?" before Cortex proceeds. The emoji prompt in particular introduces cognitive friction at the moment the user wants to log a $350K award before forgetting the details. For non-dev personas this pattern repeats on every new project and erodes trust in the tool's judgment.

**Suggested fix:** Make emoji selection opt-in (offer it as a follow-up rather than a required step). The repo-link prompt should only appear if `personality.md` indicates the user has a developer context (e.g. a `domain` value like `shopify`, `wordpress`, or the presence of a `repo_paths` entry in the registry). Add a `skip_interactive` parameter to `scaffold_project` MCP that bypasses both prompts for fast scaffolding.

---

## Summary

The Cortex daily loop is largely coherent for a developer persona embedded in a code repo. For a nonprofit grant manager working from `~/` (L1/L2), the four most damaging gaps are: (1) the hub format mismatch that silently empties the L3 boot greeting of its most critical content; (2) the MCP tool directly contradicting the skill's "remove resolved items entirely" contract; (3) the hook's narrow trigger phrase list missing the natural language grant managers actually use to signal resolution; and (4) the semantic search returning stale results for anyone who writes in Obsidian between Claude sessions. The tool's taxonomy is also anchored to one user's work structure, which makes a new-user persona feel like an afterthought.

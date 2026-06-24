---
avatar: "06"
persona: "Attorney — confidentiality-critical, privilege concerns, wary of auto-capture leaking client data"
surface: "Claude Desktop"
audit_date: 2026-06-01
auditor: claude-sonnet-4-6
---

# Daily-Use Audit — Avatar 06: Attorney

## Persona

**Name:** Marguerite  
**Role:** Solo-practice attorney (trusts & estates / litigation support)  
**Surface:** Claude Desktop (plugin-installed, vault on local iCloud Drive)  
**Primary concern:** Attorney-client privilege. Anything that lands in a searchable, versioned, networked vault without explicit consent is a potential privilege waiver or a bar complaint waiting to happen.  
**Secondary concern:** Conflicts of interest. A recall_related hit that cross-leaks one client's facts into a session working on a different client's matter is catastrophic.  
**Vault structure:** `Work/Clients/<ClientName>/<Matter>/` — each matter is a registered project. Knowledge Base has practice-area notes. Memory.md contains general preferences.

---

## Day Narrative

**8:45 AM — First session of the day.**  
Marguerite opens Claude Desktop at her desk, cwd somewhere in `~/Documents/Research`. Boot fires. `boot-context.py` reads her vault, computes L1 (no cwd match), loads personality, memory, changelog tail, and injects the `<cortex-session>` block. She types: *"draft a demand letter for the Holloway matter."*

The `user-prompt-submit` hook scans the prompt. `"Holloway"` doesn't match any trigger phrase (trigger-phrases.md rows 1–22), so no skill hint is injected. But `cortex-boot` has loaded memory.md and personality.md — both already sitting in context, both potentially referencing other client names, other matters, and cross-matter patterns from prior sessions.

**cortex-boot Step 6 (Ambient recall)** fires. It passes the user's request verbatim to `recall_related` with `context = "draft a demand letter for the Holloway matter"`. The semantic search indexes *all* `.md` files in the vault — every client matter, every meeting note, every decision log. It returns the top 5 results with `score > 0.5`. One of those results is `2025-11-14 Anderson Estate Dispute.md` (score 0.62) — a completely different client — because it also involves a demand letter. Cortex surfaces it: *"Worth knowing: you've already documented this pattern in [[2025-11-14 Anderson Estate Dispute]]."*

A privileged file for Client A has just been surfaced in a session working on Client B's matter. Marguerite has no explicit control over what `recall_related` returns, no per-client scoping, and no way to pre-declare off-limits paths.

**9:30 AM — Client call with Holloway, using Granola.**  
Granola records the call. Marguerite says *"from my call with Holloway"* or pastes the Granola transcript. `user-prompt-submit` matches `"from my call with"` at hook line 75 → routes to `cortex-process-meeting` with confidence "high". The skill fires.

`cortex-process-meeting` Step 2 extracts decisions, action items, scope changes, **and client preferences** — then hands every extracted decision and blocker directly to `cortex-update-context`, which writes them to the project hub and Changelog. This all happens under the "Tier 1 — Always capture, silently" rule (`capture-rules.md` line 33): *"Tier 1 never asks permission."*

The Holloway call transcript contains privileged strategy — litigation positions, settlement valuation, expert-witness concerns. None of this is in-scope for vault capture, but Cortex doesn't have a "legal privilege" flag. It extracts and writes because that's what the capture rules mandate for meeting transcripts.

**10:15 AM — Asking a status question.**  
*"What's blocking the Holloway matter?"* `cortex-check-status` fires, reads the hub. Fine. But if Marguerite had typed *"what's blocking the Anderson case"* in the same session, `cortex-check-status` reads the Anderson hub file — and the ambient recall from Step 6 would have already pulled Anderson into working context. Nothing isolates the two client matters within a session.

**11:00 AM — Incidental decision in conversation.**  
Marguerite discusses strategy: *"I'm going to go with a negligence framing rather than breach of fiduciary duty."* This is an L3 session (registered repo match for the Holloway matter). Per `activation-levels.md` line 47: L3 is **read-only by default** — explicit trigger required to write. But `capture-rules.md` describes Tier 1 ambient capture that fires regardless: *"User makes a scope, strategy, or direction decision → Project hub + Changelog.md."*

There is a direct contradiction between `activation-levels.md` (L3 = read-only unless triggered) and `capture-rules.md` (Tier 1 fires for strategy decisions without asking). The model sees both documents and must choose — the outcome is nondeterministic, but an LLM following the capture-rules.md framing ("Tier 1 never asks permission") may write privileged litigation strategy into the vault without any user confirmation.

**11:45 AM — post-tool-use hook fires after vault write.**  
If a file was written during the Holloway session, `post-tool-use` at step 8b spins off a background re-index job: `node reindex-one.js "$VAULT_PATH" "$REL_PATH"`. This embeds the new privileged note into the local SQLite vector database (`.cortex/search.db`). That database now permanently stores a semantic embedding of privileged content, queryable by every future recall_related call across all clients.

**12:30 PM — Memory flush at session end.**  
`stop` hook fires. If any `pending-memory.json` entries accumulated during the session, they are appended silently to `memory.md` — a file loaded globally into every future session, regardless of client context. A fact derived from a Holloway session conversation could leak into the global memory that boots with every new session.

**3:00 PM — Afternoon session, different matter.**  
Marguerite opens Claude for the Anderson estate matter. Boot loads the global memory.md (now potentially containing Holloway-derived entries), loads the full vault personality, and injects the recent changelog (15 lines, `_changelog.txt` tail, `boot-context.py:83`) — which may include timestamped entries showing Holloway vault writes from this morning. An adversarial reviewer could reconstruct case activity from the changelog alone.

---

## Findings

### Finding 1 — Ambient recall crosses client-matter boundaries without scoping (P0)

**Area:** recall  
**Evidence:** `skills/cortex-boot/SKILL.md:73–88` — Step 6 calls `recall_related` with the user's verbatim request and `limit: 5`, surfacing notes with `score > 0.5`. `mcp-servers/cortex-vault/tools/recall-related.js:41–96` — the handler queries `ALL` indexed notes; the only filtering is `exclude_paths`. There is no per-client, per-matter, or per-folder scoping parameter.  
**Impact:** A request like "draft a demand letter for the Holloway matter" will semantically match prior demand-letter work from unrelated clients and surface those privileged notes in chat. This is a cross-client privilege leak and a potential conflict-of-interest disclosure. For an attorney, this is not a UX annoyance — it is a professional liability event.  
**Suggested fix:** Add an `include_paths` filter (or equivalently a `restrict_to_folder` parameter) to `recall_related`. In `cortex-boot` Step 6, when the session is L3 (project matched), default `include_paths` to the matched project's `vault_path`. At L1/L2, suppress recall entirely unless the user has explicitly asked a question that references vault content. Document the scoping behavior in the SKILL.md so attorneys know it is in effect.

---

### Finding 2 — Tier 1 silent capture contradicts L3 read-only contract (P0)

**Area:** capture  
**Evidence:** `references/activation-levels.md:47` — "Default: read-only against the vault. Explicit user confirmation is required before writing from a repo-context session." Directly contradicts `references/capture-rules.md:33` — "Tier 1 never asks permission." The model receives both documents in the session context with no explicit precedence rule between them for L3.  
**Impact:** The model's behavior is undefined when it detects a strategy decision in an L3 session. One plausible resolution is to follow capture-rules.md (writes silently). This would write privileged litigation strategy — framing choices, settlement positions, expert-witness notes — to the vault's Changelog and project hub without any user confirmation. For a lawyer, silent capture of privileged content into a persistent, searchable store is a direct privilege management failure.  
**Suggested fix:** Resolve the contradiction explicitly in both documents. The L3 read-only contract should supersede Tier 1 for L3 sessions. Add a sentence to `capture-rules.md` under Tier 1: "Exception: L3 sessions are read-only by default; Tier 1 signals in an L3 session escalate to Tier 2 (ask first) unless the user has used an explicit trigger phrase from trigger-phrases.md rows 6–9." Mirror this in `activation-levels.md`.

---

### Finding 3 — Meeting transcript auto-processing captures privileged content without consent gate (P1)

**Area:** capture  
**Evidence:** `hooks/user-prompt-submit:73–77` — the phrase "from my call with" hard-routes to `cortex-process-meeting` at confidence "high" with no per-call confirmation. `skills/cortex-process-meeting/SKILL.md:88–91` — "Tier 1 never asks permission. If the conversation contains one of these signals and the destination is obvious, write it." The structural transcript detection at `hooks/user-prompt-submit:60–68` also fires silently on 20+ lines with 3+ speaker labels.  
**Impact:** An attorney pasting a privileged call transcript to ask Claude a narrow drafting question ("from my call with Holloway, help me draft point 3 of the motion") will trigger full meeting processing — decisions extracted, blockers logged, strategy written to the project hub — without ever being asked. The transcript route is a hard route: no confirmation gate exists between paste and write. This is a P1 rather than P0 only because the user explicitly pasted the transcript; but the lack of any "about to process and write this meeting" confirmation is a severe trust gap for the legal persona.  
**Suggested fix:** Add a confirmation step before any meeting write: "I detected a meeting transcript — shall I file it and extract decisions to the Holloway vault? (yes / no / read only)". This is a one-line ask that fits the "one sentence at the next natural pause" principle already in `capture-rules.md:47`. Hard-route structural detection should gate on confirmation before filing, not before detection.

---

### Finding 4 — Global memory.md accumulates cross-matter facts and leaks them into all future sessions (P1)

**Area:** capture  
**Evidence:** `hooks/stop:135–170` — `pending-memory.json` entries are appended to `$VAULT_PATH/memory.md` unconditionally. `hooks/lib/boot-context.py:45–57` — `memory.md` is loaded at every session start, capped at 100 lines but with no filtering by project or client. `hooks/lib/boot-context.py:409` — memory is included in the session block regardless of which cwd/project is active.  
**Impact:** A memory entry from the Holloway matter ("Holloway prefers email over phone; strategy is aggressive pre-litigation demand") will be visible in the context of every future session, including sessions for competing or adverse clients. Even if no explicit conflict exists, it undermines the attorney's ability to maintain clean mental separation between matters.  
**Suggested fix:** Memory entries should be tagged with the project context at write time (project ID from the session block). Boot should partition memory: global entries always loaded, project-tagged entries only loaded when that project is active (L3). The pending-memory.json format should include a `project_id` field populated by the skill that schedules the update. This is a vault-conventions change but the write path in the stop hook is the right enforcement point.

---

### Finding 5 — `_changelog.txt` tail in every boot exposes cross-client activity history (P2)

**Area:** boot  
**Evidence:** `hooks/lib/boot-context.py:72–83` — reads last 15 lines of `_changelog.txt` unconditionally. `hooks/session-start:100–103` — includes `recent_activity` in the `<cortex-session>` block for every session. The changelog is a single file covering the entire vault — all clients, all matters, all operations.  
**Impact:** The 15-line tail of `_changelog.txt` may show file writes from a different client's session earlier the same day: `[2026-06-01 09:14] UPDATED | FILE: Holloway v. Smith — Project Context.md | DEST: Work/Clients/Holloway/...`. That entry appears in the session block of the Anderson matter opened at 3 PM. It does not directly disclose privilege, but it exposes matter names and activity timestamps in a context where they do not belong. In a regulatory-adjacent environment, this comingles case metadata across contexts.  
**Suggested fix:** When the session is L3, filter `recent_activity` to only changelog lines that reference the active project's `vault_path`. This is a one-line Python filter in `boot-context.py:read_changelog` or in the `main()` assembly block. For L1/L2, the full tail is appropriate; for L3, scope it.

---

### Finding 6 — `open_question` resolve action leaves strikethrough residue inconsistent with the cortex-update-context spec (P2)

**Area:** capture  
**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js:77` — `resolveQuestionInBody` changes `- [ ] text` to `- [x] text — Resolved: <resolution>`, leaving the resolved item in the Open Questions section as a checked checkbox. `skills/cortex-update-context/SKILL.md:90–97` explicitly states: "Remove the row from the Hub's Open Questions table entirely. Do not use strikethrough. Do not mark it 'resolved' in-place." The MCP tool directly contradicts the skill spec.  
**Impact:** For a legal persona who relies on the Open Questions table as a clean blocker list, resolved items that remain in-place (even checked) clutter the table and could be misread on a quick scan. More importantly, a resolved blocker for a sensitive deadline or a court date that appears to remain "in the table" (just checked) creates false ambiguity about whether the issue is truly cleared. This is lower severity than the privacy findings but is a real daily-use friction point whenever blockers are resolved.  
**Suggested fix:** Update `open-question.js:resolveQuestionInBody` to remove the matched line entirely from the body (or splice it out of the lines array), rather than converting it to `- [x]`. Add the resolution text to the Changelog entry (already done at line 181) but not the body. Align the tool behavior with the SKILL.md spec.

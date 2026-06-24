---
avatar: 30
persona: Mixed work+personal single vault; bucket-term and hierarchy ambiguity all day
surface: Claude Desktop
date: 2026-06-01
auditor: stress-test-subagent
---

# Daily-Use Audit — Avatar 30

## Persona

Mixed work+personal single vault. Uses a custom `bucket_term` (e.g. "Areas" instead of "Work") alongside personal folders like `Personal/`, `Weekly Reviews/`, and `Knowledge Base/`. Has 4–6 active client projects running concurrently with overlapping names (two clients whose project names contain a shared word like "Brand" or "Launch"). Frequently jumps between a project repo cwd, the vault root in Finder, and unrelated personal tasks in the same day. Relies on Cortex's ambient recall and auto-capture to surface cross-project context.

---

## Day Narrative

**8:45 AM** — Opens Claude Desktop from Finder with cwd at `~/Documents/`. Vault is at `~/Documents/The Vault`. Session-start hook fires. `boot-context.py` resolves cwd `~/Documents/` — this is *one level above* the vault root, not inside it. The vault is at `~/Documents/The Vault`. `is_inside_vault` check is: `cwd_real.startswith(vault_real + os.sep)`. `~/Documents/` does not start with `~/Documents/The Vault/`, so the check fails. Cortex boots at L1 — Passive. Fine for now.

**9:10 AM** — User asks "what's the status of the Brand Refresh project?" There are two projects matching "Brand Refresh" — one personal, one a client engagement. `user-prompt-submit` hook fires and routes to `cortex-check-status`. The skill's fuzzy-match hits two candidates. It lists them and asks the user to pick. The user picks #1. `cortex-check-status` calls `read_hub` MCP tool. But here the `read_hub` tool extracts `open_questions` and `blockers` from the hub file using `## Open Questions` and `## Blockers` as *separate* section headers. The `boot-context.py` parser, however, looks for `## Open Questions & Blockers` (a combined table) — the two parsers are looking for different section names. If the user's vault follows the convention from `workflows/process-meeting.md` (which only mentions "Open Questions"), `read_hub.js` may return an empty blockers list even when blockers exist, because those blockers live under the combined `## Open Questions & Blockers` heading that `boot-context.py` scans correctly.

**10:30 AM** — User pastes a 25-line Granola export. The meeting mentioned both the Brand Refresh client AND briefly touched a personal finance decision ("we'll move the emergency fund to a HYSA"). `user-prompt-submit` detects a transcript (20+ lines, 3+ speaker labels) and routes to `cortex-process-meeting`. The skill asks "which project?" — good. User says "Brand Refresh — the client one." `cortex-process-meeting` processes it and calls `thread_meeting` MCP tool. The tool requires `series_count >= 3` to thread (`thread-meeting.js:194`). If this is only the 2nd meeting in the Brand Refresh series, threading is skipped silently (a non-error message is returned). But the personal finance remark ("move emergency fund to HYSA") is a Tier 1 capture signal — a personal scope/direction decision. Since the conversation is anchored to the client meeting, `cortex-update-context` will be called for the meeting's extracted decisions, but the personal financial decision has no obvious project to land in. There is no personal "Finance" project scaffolded. Tier 1 capture rule says: "If Tier 1 destination doesn't exist yet — escalate to `cortex-ingest-project`." This means an idle remark inside a client meeting transcript triggers a new project scaffold prompt. The user is blindsided.

**11:15 AM** — User says "log this — I'm going with Tailwind for the Brand Refresh project" (client one). `user-prompt-submit` fires and routes to `cortex-update-context`. The skill asks "which Brand Refresh?" — correct behaviour, but the trigger phrase in `user-prompt-submit` (`*"i'm going with"*`) fired on the raw phrase before any disambiguation. The hint injected reads `likely-skill: cortex-update-context | confidence: high`. The skill correctly asks once. However: the `open_question` MCP tool resolves blockers using case-insensitive substring match (`resolveQuestionInBody` in `open-question.js:66`). If the user has two open questions that both contain the word "design" (e.g. "confirm design direction" and "finalize design tokens"), the first one in document order will be resolved — silently. There is no confirmation of *which* question was matched. The wrong question could get marked resolved.

**12:45 PM** — User opens a session directly inside the Shopify repo: `cd ~/code/shopify-build`. Session-start hook fires. `boot-context.py` walks up from `~/code/shopify-build`. If this repo is registered in `registry.json` under the vault (which lives at `~/Documents/The Vault`), the walk-up logic in `resolve_cwd` will hit `~/code`, then `~`, then stop (the loop stops at `home`). The registered repo path might be `~/code/shopify-build` but `os.path.realpath` could resolve differently if the user has a symlink (e.g. `~/code` → `/Volumes/Data/code`). If the realpath of the registered path and the realpath of the cwd ancestor don't match, the project is silently missed and the session boots at L1 instead of L3. The user gets no project context for what should be a full-project session.

**2:00 PM** — Mid-session the user says "explain why Tailwind purges unused CSS in production." The `user-prompt-submit` hook runs. It detects `*"explain"*` and injects a `teaching-moment` hint. This fires for every "explain" message, even trivial factual questions. The hint is harmless but the `stop` hook then checks for `pending-signals.json`. If the user ends the session, the stop hook logs a signal to `Knowledge Base/Growth/_signals.log`. A throwaway "explain X" question from a developer gets logged as a teaching moment in a Growth coaching file. Over time this corrupts the coaching signal quality with noise from incidental explanations. There is no minimum relevance gate — any "explain" phrase produces the signal.

**3:30 PM** — User asks `recall_related` to surface vault notes related to "emergency fund strategy." The `recall-related.js` handler truncates the context to 2000 characters (`MAX_CHARS = 2000` in `embeddings.js:5`), embeds, and queries `vec_notes`. The `score` is computed as `1 - distance/2`. This is the cosine-similarity formula assuming `sqlite-vec` returns L2-normalized cosine distance in `[0, 2]`. That formula is technically correct for cosine distance from sqlite-vec's `vec0` — BUT only if the vectors were normalized at index time. Looking at `embeddings.js:25`: `normalize: true` is passed to the HuggingFace transformer. So vectors should be normalized. Score should be valid. However: the `why` field in `recall-related.js` is populated from a synchronous `fs.readFileSync` inside a result map callback (`extractWhy` at line 18). For a vault with many notes (100+) and 5 results, this does 5 synchronous reads AFTER the DB query, on every recall call — inside the async `handler`. This is a minor perf tax but not a bug.

**4:15 PM** — User opens a personal session (cwd is `~/Desktop`). Types "new project — tracking home renovation". `user-prompt-submit` routes to `cortex-ingest-project`. The skill calls into `scaffold-project`. The user's vault has a custom `bucket_term` ("Areas") and a custom `project_term` ("Initiative"). The `scaffold_project` tool (not read but referenced by `cortex-ingest-project`) would use the `personality.md` to resolve these. The day ends.

---

## Findings

### 1. `read_hub.js` and `boot-context.py` parse different section header names — blockers are invisible in `read_hub`

**Area:** status  
**Severity:** P1

`boot-context.py` (line 206) searches for `## Open Questions & Blockers` as a combined Markdown table. It classifies rows by `typ` column value (Dependency/Internal → blocker, else → open question).

`read_hub.js` (lines 44–61) instead looks for two **separate** sections: `## Open Questions` and `## Blockers`, expecting a `- [ ]` checklist format.

These two parsers assume different hub document shapes. A vault generated by `cortex-process-meeting` / `cortex-update-context` follows the `workflows/process-meeting.md` template, which uses `## Open Questions` in checklist format. But `boot-context.py` expects a Markdown table under a combined heading. Users with a mixed history will see blockers appear in the L3 session banner (if their hub was scaffolded pre-onboarding-rewrite with the table format) but disappear when `cortex-check-status` calls `read_hub`. Or vice versa.

**Evidence:** `hooks/lib/boot-context.py:206` (`## Open Questions & Blockers` + table row parsing) vs `mcp-servers/cortex-vault/tools/read-hub.js:44–61` (`## Open Questions` + `## Blockers` + checklist parsing).

**Impact:** For a multi-project daily user, `what's blocking X` returns empty even though the L3 boot banner correctly shows blockers. The user will stop trusting the status check.

**Suggested fix:** Pick one canonical format (the `- [ ]` checklist used by `read_hub.js` and all write-side skills) and update `boot-context.py` to use the same parser. Add a migration note in `references/vault-conventions.md`.

---

### 2. `open_question` resolve uses first-match substring — silently resolves the wrong question when two questions share keywords

**Area:** capture  
**Severity:** P1

`open-question.js` line 66: `resolveQuestionInBody` finds the first unchecked question line whose lowercased text contains the lowercased `text` argument as a substring. It returns no count of candidates found, no warning if multiple lines matched. The caller (via MCP) receives `{ success: true }`.

If a project hub has:
```
- [ ] Confirm design direction with client
- [ ] Finalize design token naming
```

And the user says "blocker resolved — design direction confirmed", the `text` arg passed is likely "design direction". That matches line 1 correctly. But if the user says "design" only (a substring of both), line 1 is resolved silently, potentially the wrong one. In a live mixed-project session where `cortex-update-context` calls `open_question` with a fuzzy extracted string from conversation, the match is ambiguous.

**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js:66–79` — `matchIdx` finds the first match and returns immediately; no disambiguation.

**Impact:** Wrong blocker gets marked resolved. Data integrity loss in the project hub. The Conflict Rule is never triggered because the current state check only happens at the write-routing level, not inside the resolve path.

**Suggested fix:** When `resolveQuestionInBody` finds more than one matching line, return a list of candidates and require the caller to specify the exact match (or a 0-indexed position). Surface the ambiguity to the user before writing.

---

### 3. Personal scope decisions inside a client meeting transcript trigger unexpected new-project scaffolding

**Area:** capture  
**Severity:** P1

`capture-rules.md` line 29 (Tier 1): "User makes a scope, strategy, or direction decision → Project hub + Changelog.md." The failure mode table (line 91) states: "Tier 1 destination doesn't exist yet → escalate to `cortex-ingest-project`."

In a mixed work+personal vault, the user often dictates personal decisions into a meeting recap ("while we were chatting I decided to consolidate our HYSA accounts"). These surface as Tier 1 capture signals. Since no personal "Finance" or "Personal Planning" project is scaffolded, Cortex is expected to escalate to `cortex-ingest-project`.

But the user was processing a *client meeting* — they expect one clean "meeting filed" confirmation, not a mid-flow "this looks like a new project — scaffold Finance?" prompt. This is especially disruptive on Claude Desktop where the user is context-switching between work and life constantly.

**Evidence:** `references/capture-rules.md:91` (escalation rule) + `skills/cortex-process-meeting/SKILL.md:95` (decision/blocker extraction hands off to `cortex-update-context`) + `skills/cortex-update-context/SKILL.md:206` (no project → escalate to `cortex-ingest-project`).

**Impact:** Personal asides in work meeting transcripts interrupt the meeting-processing flow with new-project scaffolding prompts. For a mixed vault user this happens multiple times a week.

**Suggested fix:** Add a "personal/non-project context" category to the routing table. Decisions with no project match that occurred inside a meeting transcript should be filed in a `_Inbox/` holding note and surfaced with "1 personal item didn't map to a project — want me to park it in Inbox?" rather than triggering a full scaffold flow mid-meeting.

---

### 4. `resolve_cwd` walk-up stops at `$HOME` — symlinked repo paths silently miss L3 activation

**Area:** boot  
**Severity:** P1

`boot-context.py` `resolve_cwd` (lines 129–154): the walk-up loop uses `os.path.realpath(cwd)` for the current path but only dereferences the cwd side, not the registry side. The comparison at line 143: `if os.path.realpath(repo_path) == candidate`. The `candidate` variable is derived from `cwd_real = os.path.realpath(cwd)` (line 129), so the cwd side IS realpath'd. The repo_path side is also realpath'd. So symlinks should resolve on both sides.

However: the loop also stops early when `candidate == home` (line 147). If a developer has their repos at `~/code/` and `~/code` is their home directory (uncommon but happens on some setups), the loop exits before checking `~/code/project`. More relevantly: if the repo is registered with a slightly different path format (trailing slash, relative vs absolute), `os.path.realpath` won't unify them because realpath doesn't strip trailing slashes on all Python/OS combos.

More critically for this persona: if a user registered a repo using a symlinked path (e.g., registered as `/Volumes/Data/code/shopify` while the actual home-relative path is `~/code/shopify`), and `$HOME` resolves to `/Users/ben`, then `cwd_real` starts with `/Users/ben` but the registered `repo_path` realpath might resolve to `/Volumes/Data/code/shopify` — which doesn't share a prefix with `/Users/ben`. The walk-up would correctly dereferenced on both sides IF the user's realpath chain is consistent — but on macOS with an external drive or iCloud Drive symlink, it will fail silently.

**Evidence:** `hooks/lib/boot-context.py:129,143,147` — `cwd_real`, `os.path.realpath(repo_path)`, and the `candidate == home` stop condition. No normalization of trailing slashes.

**Impact:** L3 never activates for a repo session. The user gets L1 — no project banner, no blocker awareness, no scope-creep monitoring. The most valuable session type silently degrades.

**Suggested fix:** Normalize paths before comparison: strip trailing separators. Also add a fallback: if `resolve_cwd` returns L1 but a `CLAUDE.md` stub with Cortex markers is found walking up, surface "Looks like this might be registered — check repo paths?" rather than silently booting at L1.

---

### 5. `user-prompt-submit` "explain" teaching-moment detection is too broad — poisons coaching signal log with routine questions

**Area:** hooks  
**Severity:** P2

`hooks/user-prompt-submit` lines 172–178: any prompt containing the word `explain`, `why does`, `how does`, `walk me through`, `show me how`, or `help me understand` injects a `teaching-moment` hint. The `hooks/stop` lines 50–97 then write all accumulated `pending-signals.json` entries to `Knowledge Base/Growth/_signals.log`.

There is no relevance gate, no length minimum, no check that the question is in a domain that the user has opted into coaching for. A mixed work+personal user asking "explain why this regex doesn't match" while debugging client code gets a coaching signal logged. "Help me understand how to set up direct deposit" triggers the same flag. Over a month this generates hundreds of signals most of which are not meaningful coaching opportunities.

The downstream consumer (`cortex-coach`) will read `_signals.log` and derive a picture of what the user needs to learn — but if 70% of signals are trivial how-to questions, the coach's recommendations become noisy.

**Evidence:** `hooks/user-prompt-submit:172–178` (teaching trigger detection — no relevance filter) + `hooks/stop:67–96` (unconditional flush to `_signals.log`).

**Impact:** `cortex-coach` recommendations degrade over time for active users. Minor per-session but compounds daily.

**Suggested fix:** Gate teaching-moment injection on a minimum threshold: the prompt should be >3 sentences OR involve a topic the user's `_profile.md` already flags as a growth area. Alternatively, move the signal from being a hook-injected hint to a model-side judgment call only when `cortex-coach` is explicitly invoked.

---

### 6. `thread_meeting` requires 3+ entries but MCP SKILL says "2+ prior" — threading skips silently on the 2nd meeting

**Area:** meeting  
**Severity:** P2

`mcp-servers/cortex-vault/tools/thread-meeting.js` line 194: `if (effectiveGroup.length < 3)` → return a non-error "Skipping" message. This means the *second* meeting in a series does NOT get threaded — only the third and beyond.

But `skills/cortex-process-meeting/SKILL.md` lines 70–74 state the threading rule as: "A series exists when 3 or more meetings in the same folder share a stable title suffix". The SKILL says 3 is the threshold to *establish* the series, which is consistent. However, the typical user mental model is "I've had 2 standups, they should be linked." The SKILL note and the JS code are internally consistent with each other, but they are inconsistent with user expectations for a recurring 1:1 or standup cadence (where the 2nd meeting is the natural time to create the first backward link).

For this persona who runs multiple recurring client check-ins, the first several meetings in each series accumulate as unlinked notes. The user won't discover this until they manually navigate the folder and see no threading.

Additionally: when `thread_meeting` returns the "need at least 3" message, it returns a `content` array with `isError: false` (no error flag). The caller (`cortex-process-meeting`) sees a successful MCP call, but threading was silently skipped. The meeting filing confirmation line says nothing about threading being skipped.

**Evidence:** `mcp-servers/cortex-vault/tools/thread-meeting.js:194` (`length < 3` check, non-error return) vs user expectation of 2-meeting backward linking.

**Impact:** New recurring series (client check-ins, standups) accumulate 2 unthreaded orphan notes before any linking happens. For an active client-services user running 5+ recurring series, this means ~10 orphan notes at any given time.

**Suggested fix:** Lower the threshold to 2 (`effectiveGroup.length < 2`). The second meeting in a series should always link back to the first. If needed, rename the internal concept: "thread on 2nd instance" vs "display as a named series on 3rd instance." Also explicitly surface "threading skipped — first/second in series" in the meeting filing confirmation so the user is aware, not surprised later.

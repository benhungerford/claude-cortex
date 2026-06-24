---
audit_date: 2026-06-01
avatar_id: "04"
persona: Solo SaaS founder — dozens of product/strategy decisions a day
surface: Claude Code CLI
auditor: claude-sonnet-4-6
---

# Daily-Use Audit — Avatar 04

## Persona

Solo SaaS founder running 3-5 active product/client work streams simultaneously. Makes 10-30 strategic or product decisions a day, many of them mid-conversation and unannounced. Opens multiple Claude Code sessions throughout the day — some in repo directories (L3), some from a scratch folder or home directory (L1), occasionally inside the vault itself (L2). Uses Granola to record client calls. Depends on Cortex to silently capture decisions so nothing slips through the gap between "thinking out loud" and "actually logged."

The persona's failure mode is: decisions get made, no trigger phrase is used, Cortex sits passively, and six weeks later nobody can reconstruct what was decided or why.

---

## Simulated Day-in-the-Life

**8:47 AM — Morning session, repo CWD (L3)**

Opens Claude Code from inside `~/dev/saas-app/`. Boot fires. Python walks cwd up, matches against registry, finds the project. Session block emits: `Level: L3 — Full Project`, `Project: SaaS App`, stage, blockers. `cortex-boot` fires, produces one opening line. Clean.

Founder types: *"let's think through whether to add a free tier"*. This is exploratory — Tier 3 per capture-rules.md. Cortex stays silent, correct behavior. They bat it around for 10 minutes.

Then: *"ok I think we're going to do it — free tier, 3 seats, no credit card."* This is a Tier 1 signal — scope/direction decision. `user-prompt-submit` hook fires, checks the message against trigger patterns in `hooks/user-prompt-submit` line 93: looks for `"we decided"`, `"i'm going with"`, `"going to go with"`, `"final answer is"`, `"we're using "`. The phrase *"we're going to do it"* does not match any of these. No `<cortex-hint>` is injected. The cortex-boot ambient capture watch is supposed to catch it — but the boot skill's watch is model-side (conversational), not hook-side. Whether it fires depends on whether the model notices the Tier 1 signal in that turn. **This is a real miss risk.** The decision goes unlogged unless the model happens to catch it.

**10:15 AM — Slack-equivalent interruption, same session**

*"quick one — Ashley confirmed she's fine with moving the onboarding flow to phase 2."* Clear scope change, Tier 1 per capture-rules.md example 3. No explicit trigger phrase. Same miss risk as above.

**11:30 AM — Status check**

*"what's blocking the SaaS App right now?"* Hook fires, `what's blocking` matches at `user-prompt-submit` line 149. Cortex routes to `cortex-check-status`. Reads hub, surfaces blockers with file citation. This works well.

**1:00 PM — Client call processed**

Granola produces transcript. User pastes it. `user-prompt-submit` detects 20+ lines with 3+ speaker-label lines (line 63). Routes to `cortex-process-meeting`. `thread_meeting` MCP tool fires to add Previous/Next links. This mostly works. But: `thread_meeting` requires 3+ entries in the series before it threads (line 194 of `thread-meeting.js`). The first two instances of any recurring series get no threading at all — both silently return "Skipping." The founder who's been using Cortex for 2 weeks has most series at 1-2 entries. They won't see threading for weeks.

**2:45 PM — Knowledge capture attempt**

Debugging a Stripe webhook retry bug, discovers a non-obvious behavior. Says *"this is worth saving for next time."* The phrase `worth remembering` is in `user-prompt-submit` line 127 and routes to `cortex-knowledge` with `confidence: medium`. Good. But `worth saving` (without "remembering") is not in the pattern. Miss.

**3:30 PM — New session, scratch CWD (L1)**

Opens Claude Code from `~/Desktop/scratch`. Boot fires, cwd not in vault or any registered repo. L1 passive. Founder says: *"I've decided we're dropping the enterprise tier entirely."* This hits the `"we decided"` pattern in `user-prompt-submit` line 93. `cortex-update-context` is hinted. But at L1, the skill doesn't know which project this belongs to. The skill's procedure says ask once: "Is this for <closest-match>?" — but the project name "enterprise tier" may not fuzzy-match anything in the bucket list from `personality.md` since that list was extracted by `extract_buckets()` at boot and injected as `active_projects`. If the project name isn't distinctive enough to match, Cortex asks the user to clarify. That's one extra friction step for every single decision made outside a registered repo — which for this founder is most decisions.

**4:00 PM — `open_question` MCP tool bug discovered**

Founder says *"that Stripe credentials blocker is resolved"* → `cortex-update-context` fires → calls `open_question` MCP tool with `action: "resolve"`. `resolveQuestionInBody` in `open-question.js` at line 66 marks the item `- [x]` (checked checkbox format) instead of removing it entirely. The SKILL.md at `cortex-update-context` line 91 explicitly says to **remove the row** — not strikethrough, not check. But the MCP tool writes `- [x] …` with a strikethrough-equivalent. The skill's own stated "Blocker-Resolved Rule" is violated by the tool the skill is told to prefer.

**5:30 PM — Stop hook fires**

Session ends. Stop hook reads `pending-memory.json`. If nothing was written there by the model (which depends on the model correctly staging memory updates — there's no in-conversation prompt to do this), the flush is a no-op. The founder has no feedback that memory.md was or wasn't updated unless they go look.

---

## Findings

### Finding 1 — Ambient capture misses natural-language decisions at L3

**Severity: P1**

The `user-prompt-submit` hook only catches decisions that use exact trigger phrases (`"we decided"`, `"i'm going with"`, `"going to go with"`, `"final answer is"`, `"we're using "`). At L3, the founder makes decisions mid-conversation using natural language: *"we're going to do it"*, *"let's go with X"*, *"I think X is the right call"*, *"yeah let's do that"*, *"that settles it."* None of these match the hook patterns (`hooks/user-prompt-submit` lines 86-110).

The ambient capture described in `references/capture-rules.md` (Tier 1 "Always capture, silently") relies on the *model* detecting the signal — there is no hook-side pattern to catch these. The model-side watch is present only if `cortex-boot` is running and the model stays attentive across a long session. In a 40+ turn session the model's attention drifts and misses are common.

**Evidence:** `hooks/user-prompt-submit` lines 86-110 (exhaustive trigger list). `references/capture-rules.md` Tier 1 table. `skills/cortex-boot/SKILL.md` lines 6, 71-88 (ambient recall, not ambient capture).

**Suggested Fix:** Add a broader natural-language capture hint pattern to `user-prompt-submit` — e.g. `*"let's go with"*`, `*"i'll go with"*`, `*"yeah let's"*` combined with project-name context — and route with `confidence: medium` to `cortex-update-context`. A medium-confidence hint causes the model to pause and ask "want me to log this decision?" rather than capturing silently, which is correct for soft matches. This gives the founder a confirmation step without requiring magic words.

---

### Finding 2 — `open_question resolve` uses strikethrough (`- [x]`) instead of row removal

**Severity: P1**

The `cortex-update-context` skill's "Blocker-Resolved Rule" explicitly requires removing the blocker row from the Open Questions table entirely (SKILL.md lines 90-97: "Remove the row entirely. Do not use strikethrough."). However, the MCP tool the skill is told to prefer — `open_question` with `action: "resolve"` — marks the line `- [x] <text> — Resolved: <resolution>` (`open-question.js` line 77). This is a strikethrough-equivalent in Obsidian checkboxes.

Over time the hub's Open Questions table accumulates resolved-but-visible rows with `[x]` prefixes, which the skill was specifically designed to prevent. Every resolved blocker adds noise the hub table. After 20 resolutions the table is unreadable.

**Evidence:** `mcp-servers/cortex-vault/tools/open-question.js` line 77. `skills/cortex-update-context/SKILL.md` lines 90-97 ("Remove the row entirely. Do not use strikethrough.").

**Suggested Fix:** Change `resolveQuestionInBody` in `open-question.js` to splice out the matched line entirely (same as `lines.splice(matchIdx, 1)`) rather than marking it `[x]`. Add an `action: "remove"` alias for clarity. Update the returned JSON to include the removed text so the caller can log it to `Changelog.md`.

---

### Finding 3 — Thread series requires 3+ entries; first two calls of any series are silently skipped

**Severity: P2**

`thread_meeting.js` line 194: `if (effectiveGroup.length < 3) { return ... "need at least 3 to thread. Skipping." }`. For a founder who's just started using Cortex, or who starts a new meeting series (e.g. a new client), the first two meetings in any series never get threaded. The response is a non-error success that says "Skipping" — `cortex-process-meeting`'s confirmation line ("Meeting note filed: ...") does not surface this. The founder discovers months later that the first two meetings in each series are orphans with no Previous/Next links.

Additionally, the threshold asymmetry creates a subtle UX gap: meeting 3 gets linked to meeting 2, but meeting 2 has no `*Next:*` link to meeting 3 in the other direction unless it was the most-recent-prior at the time of filing meeting 3. The backfill of meeting 2 with a `*Next:*` link to meeting 3 does happen (line 237-248) only when meeting 3 is filed — meeting 1 never gets backfilled.

**Evidence:** `mcp-servers/cortex-vault/tools/thread-meeting.js` line 194. Lines 203-214 (prior note backfill logic). `skills/cortex-process-meeting/SKILL.md` lines 70-85 (threading rules say "3 or more" — consistent, but the founder's pain is real).

**Suggested Fix:** Lower the threshold to 2. A recurring meeting is detectable from the second instance, not the third. The threading rule's stated rationale (line 71: "3 or more meetings in the same folder share a stable title suffix") is overly conservative. Change line 194 to `< 2` and thread meeting 2 backward to meeting 1. This eliminates orphan first-pairs. Also: have `cortex-process-meeting`'s announce line explicitly note when threading was skipped (e.g., `(no threading — first in series)`) so the founder knows.

---

### Finding 4 — `vault-path.js` caches vault path for the MCP server's lifetime, breaking vault path changes mid-session

**Severity: P2**

`mcp-servers/cortex-vault/lib/vault-path.js` lines 4, 48-71: `let cached = undefined` — first read sets `cached` to the vault path, subsequent reads return the cached value. The MCP server is a long-running `stdio` process that persists across sessions (or at least for the duration of a Claude Code session). If the user updates their vault path in `~/.claude/cortex/config.json` mid-session (e.g., during onboarding debugging or vault migration), the MCP server will continue returning stale vault paths for all subsequent tool calls until the server process restarts.

For the SaaS founder context: if vault path is ever corrected or the user is mid-migration, all MCP tool calls silently use the old path — creates/reads/writes may go to the wrong vault. There is no error — `fs.existsSync(vaultPath)` passed at startup.

**Evidence:** `mcp-servers/cortex-vault/lib/vault-path.js` lines 4 and 48-71 (single-call lazy cache with no TTL). `clearCache()` function exists (line 73) but nothing calls it.

**Suggested Fix:** Either (a) add a TTL to the cache (re-read config if `cached` is older than 30 seconds), or (b) check `fs.statSync(configPath).mtimeMs` at each call and invalidate `cached` if config file was modified. Option (b) is zero-overhead on the hot path (stat is a fast syscall) and covers the vault migration case precisely.

---

### Finding 5 — L1 sessions produce an ambient capture dead zone: decisions made outside a repo CWD have no project context and require an extra disambiguation turn

**Severity: P2**

At L1 (most desktop/scratch sessions), when the user makes a decision with an explicit trigger phrase, `cortex-update-context` fires but has no project context loaded. The skill's procedure says "ask once: Is this for <closest-match>?" (`cortex-update-context/SKILL.md` line 203: "Project unclear from context — Ask once").

The "closest-match" has to be derived from `active_projects` in the session block — which is derived from `extract_buckets()` in `boot-context.py` lines 94-108. This only extracts bucket names and types (e.g. "FKT Shopify Website Build (web-build)"), not individual project names within buckets. If the founder works on 8 projects across 3 clients, the closest-match heuristic has to fuzzy-match the decision's subject against bucket names — and for a short phrase like "I'm going with Next.js for the portal" it may match nothing or the wrong bucket.

The result: **every explicit-trigger decision made outside a repo CWD costs one extra disambiguation turn**, every time. For a founder making 10-20 such decisions a day in non-repo sessions, this is constant friction.

**Evidence:** `hooks/lib/boot-context.py` lines 432-433 (`active_projects = extract_buckets(personality)` only in L1/L2). `hooks/lib/boot-context.py` lines 94-108 (`extract_buckets` returns name+type pairs only, no project-level entries). `references/activation-levels.md` L1 behavior description. `skills/cortex-update-context/SKILL.md` failure mode "Project unclear from context."

**Suggested Fix:** At L1 boot, include not just bucket names but the individual project names and IDs from the registry in the `active_projects` field (or as a separate `known_projects` list). The total payload is small (project names are short strings) and would let `cortex-update-context` fuzzy-match at the project level, eliminating most disambiguation turns.

---

### Finding 6 — `post-tool-use` hook fires on `Edit` tool calls to non-vault files, then silently exits after the vault-check, but still spawns a sub-process for the stdin Python call

**Severity: P3**

`hooks/post-tool-use` line 36: `INPUT=$(cat)` — reads all of stdin unconditionally before any check. Lines 40-58: calls `python3 -c "..."` to parse the JSON. Lines 63-65: if `FILE_PATH` is empty, exits 0. Lines 86-116: if `VAULT_PATH` is empty or path is outside vault, exits 0.

Every single `Edit` or `Write` tool call (including all code edits in a repo session) runs this hook, spawns a Python subprocess, extracts the path, checks if it's inside the vault, and exits if not. For a heavy coding session with 50+ file edits, this is 50+ Python subprocess spawns that all short-circuit after the vault check.

The hook is `async: false` in `hooks.json` line 20. This means every file edit is blocked until the hook completes — including the Python startup cost (~100-200ms per spawn on a cold interpreter, faster with warm kernel cache but not negligible). In a repo coding session (the most common L3 use case), essentially every edit fires this hook and it always no-ops.

**Evidence:** `hooks/hooks.json` lines 15-22 (`PostToolUse` matcher covers `Write|Edit|...`, `async: false`). `hooks/post-tool-use` lines 36-58 (unconditional stdin + Python parse before vault check). The hook could be made `async: true` for non-vault sessions — the changelog-append is fire-and-forget and the re-embedding is already fire-and-forget (line 207: `&`).

**Suggested Fix:** Change `async: false` to `async: true` in `hooks.json` for `PostToolUse`. The hook's outputs are: (1) changelog append — fire-and-forget, and (2) re-embed — already backgrounded. The `additionalContext` hint on line 215 is the only synchronous output, and it's only a one-line hint that isn't decision-critical. Making the hook async eliminates the per-edit latency penalty entirely. Alternatively, add a pre-check in the hook itself: if `CLAUDE_PLUGIN_ROOT` or a cached vault-path doesn't look like it's related to the file being edited, skip the Python parse entirely.

---

## Summary

The daily loop works well for explicit triggers and structured tasks (status checks, meeting processing). The primary friction points for a high-velocity SaaS founder are: (1) ambient capture misses natural-language decisions that don't use magic words — the most valuable decisions are the ones stated casually; (2) the `open_question` resolve action contradicts the stated blocker-removal rule; (3) every L1 session adds a disambiguation tax on explicit captures; and (4) small but real latency from synchronous hook execution on every file edit in repo sessions. The threading threshold is a minor annoyance but degrades the meeting chronology experience for the first few weeks.

# Claude Cortex — Daily-Use Audit Findings

**Plugin version:** v1.4.0
**Audit date:** 2026-06-01
**Audit type:** 30-avatar daily-use stress test
**Repo:** `/Users/benhungerford/Documents/Cortex/claude-cortex`

---

## 1. Methodology

This audit stress-tested Cortex as a *daily driver* rather than as a fresh install. The goal was to find where the plugin silently fails, misroutes, or degrades during ordinary repeated use across a wide spread of people and platforms.

**Three-stage pipeline:**

1. **Simulation (30 avatars, Sonnet sub-agents).** Each avatar is a distinct persona defined across three axes — *surface* (Claude Code CLI, Claude Desktop, iPad/Desktop), *profession* (developer, lawyer, therapist, academic, sales, PM, real-estate, content, consultant), and *edge condition* (ESL, screen-reader, multi-device sync, offline/privacy-maximalist, multi-author shared vault, 15k-note scale, brand-new empty vault, returning-after-3-weeks). Each sub-agent wrote a narrated day-in-the-life, tracing real hook/skill/MCP code paths and recording every silent failure, misroute, or friction point against `file:line` evidence. Reports live in [`avatars/`](./avatars/).

2. **Synthesis (Opus).** The 30 reports were clustered into 21 candidate themes, each with a severity, affected-avatar list, and `file:line` evidence chain. Five cross-cutting patterns were extracted.

3. **Adversarial verification (Opus, code-grounded).** Every P0/P1 theme was independently re-checked against the actual source — running greps, reading the cited lines, and in several cases reproducing the failure against the user's real vault. Each theme received a verdict of **confirmed**, **partial**, or **refuted**, with a corrected severity. This stage materially changed the picture: it refuted one theme outright (T09) and downgraded six of the seven original P0s.

**Net effect of verification:** the original synthesis proposed 5 P0s. Code-grounded verification confirmed **zero** true P0s — the privilege/PHI and cross-vault-misroute escalations rested on architectural assumptions (multi-tenant vaults, networked sync, an active memory write path) that do not hold in the single-user, single-vault, local shipping code. What survives is a tight set of real, daily-impacting correctness and signaling defects.

---

## 2. Avatar Roster

| # | Surface | Persona | Key edge condition |
|---|---------|---------|--------------------|
| 01 | CLI | Solo Shopify/WordPress dev, 2-3 clients | L3 mid-build capture |
| 02 | CLI | Freelance WordPress dev, 6 clients | rapid context-switching |
| 03 | Desktop | Non-technical agency PM (Monday.com) | never opens a terminal |
| 04 | CLI | Solo SaaS founder | dozens of decisions/day |
| 05 | Desktop | Management consultant, 5+ meetings/day | Granola + Fathom transcripts |
| 06 | Desktop | Attorney | privilege / confidentiality |
| 07 | Desktop | Academic researcher | Zotero/bibliography pastes |
| 08 | Desktop | UX designer (Figma-centric) | design decisions/critique |
| 09 | Desktop | B2B sales rep, 15 active deals | cross-deal recall |
| 10 | Desktop | Therapist/coach | HIPAA-class, anti-sync |
| 11 | Desktop | Nonprofit program manager | grant tracking |
| 12 | Desktop | Real-estate agent, 20 deals | daily status churn |
| 13 | Desktop | Content creator / writer | fleeting idea capture |
| 14 | Desktop | Grad student, low tech comfort | jargon confusion |
| 15 | CLI | Data scientist (notebooks + git) | experiment decisions |
| 16 | Desktop | Startup PM, multi-track | mid-session pivots |
| 17 | Desktop | ESL user | near-miss trigger phrasing |
| 18 | Desktop | Low-vision / screen-reader user | output verbosity & structure |
| 19 | iPad/Desktop | iPad-primary, no terminal ever | shell-less platform |
| 20 | Desktop | Multi-device (iCloud/Dropbox sync) | mid-day sync collisions |
| 21 | CLI | Power user, 15k-note vault | boot budget + recall latency |
| 22 | Desktop | Brand-new user, day 1 | near-empty vault, empty-state |
| 23 | Desktop | Connector power user | many MCP connectors |
| 24 | CLI | Privacy maximalist, fully offline | zero connectors, suspicious of writes |
| 25 | CLI | Extreme context-switcher, 8 projects | L1/L2/L3 churn per session |
| 26 | Desktop | Infrequent user, returning after 3 weeks | stale state |
| 27 | CLI | Team lead, shared vault with 3 colleagues | multi-author / concurrent edits |
| 28 | Desktop | Note minimalist | over-capture / false positives |
| 29 | Desktop | Meeting-marathon, 7 back-to-back calls | batch transcript + threading |
| 30 | Desktop | Mixed work+personal single vault | bucket-term / hierarchy ambiguity |

---

## 3. Severity Summary (post-verification)

| Severity | Count | Themes |
|----------|-------|--------|
| **P0** | 0 | all original P0s downgraded or refuted by verification |
| **P1** | 3 | T02, T12, T15 |
| **P2** | 10 (verified) | T01, T03, T05, T06, T07, T08, T10, T11, T13, T17, T20 |
| **P2 (synthesis only)** | 3 | T14, T18, T21 |
| **P3** | 4 | T04, T16, T19, T09 (refuted, retained as hygiene) |

> Note: T01 was corrected to **P1** by verification but is the highest-priority confirmed correctness defect; it is grouped with the P1 wave in the roadmap. The P2 count above lists it for completeness of "downgraded-from-P0" items but Wave assignment treats it as P1-class.

Severity reflects the **corrected** value from adversarial verification, not the original synthesis value.

---

## 4. P1 Findings (verified)

### T01 — Hub section schema is forked across three parsers
**Area:** status · **Verdict:** confirmed · **Severity:** P0 -> P1 · **Avatars (14):** 03, 05, 07, 08, 09, 11, 12, 13, 19, 21, 22, 25, 26, 30

Two incompatible hub schemas coexist: (1) a **checkbox** schema with separate `## Open Questions` / `## Blockers` headings and `- [ ]` lines — emitted by `scaffold-project.js` (which hardcodes the sections and does *not* read `blank-template.md`), read+written by `open-question.js`, parsed by `read-hub.js`; and (2) a **pipe-table** schema with a combined `## Open Questions & Blockers` table — defined by `blank-template.md` and *required* by `boot-context.py`'s regex. Consequence is silent and confirmed end-to-end: for any single hub, at least one of the two daily features (L3 boot greeting via `parse_hub`, or `cortex-check-status` via `read_hub`) reports zero blockers/questions with no error. No test covers the cross-parser contract.

- `mcp-servers/cortex-vault/tools/read-hub.js:24-62` (separate-section checkbox parser)
- `hooks/lib/boot-context.py:205-224` (combined pipe-table regex)
- `assets/blank-template.md:70-73` (combined table)
- `mcp-servers/cortex-vault/tools/scaffold-project.js:177-184` (separate freeform sections)
- `mcp-servers/cortex-vault/tools/open-question.js:32-59` (writes `- [ ]` under `## Open Questions`)

### T02 — open_question resolve leaves [x] strikethrough rows instead of removing them
**Area:** capture · **Verdict:** confirmed · **Severity:** P1 (held) · **Avatars (9):** 03, 04, 06, 07, 11, 16, 23, 27, 30

`resolveQuestionInBody` rewrites a resolved item in place as `- [x] ${originalText} — Resolved: ${resolution}` and rejoins the lines; the matched row is never removed. This directly contradicts the skill's own **Blocker-Resolved Rule** ("Remove the row entirely. Do not use strikethrough. Do not mark it 'resolved' in-place."), and the skill explicitly routes resolve operations *to this tool*. Because `read-hub.js` filters Open Questions with `/^- \[ \]/` (unchecked only), resolved `[x]` rows vanish from MCP reads but persist visibly in Obsidian — a trust-eroding view divergence. Verification also flagged a secondary precision bug: the resolution is appended to `_changelog.txt`, not the project `Changelog.md` the skill mandates.

- `mcp-servers/cortex-vault/tools/open-question.js:66-79` (rewrite in place)
- `skills/cortex-update-context/SKILL.md:88-97` (Blocker-Resolved Rule)
- `mcp-servers/cortex-vault/tools/read-hub.js:50` (unchecked-only filter hides `[x]` rows)
- `open-question.js:70` `findIndex` resolves first substring match, no multiple-candidate guard

### T12 — Boot pipeline is hook/bash/python-only; vault context dies on iPad / shell-less Desktop
**Area:** boot · **Verdict:** confirmed · **Severity:** P0 -> P1 · **Avatars (2):** 19, 22

`session-start`, `post-tool-use`, and `stop` all bail (`exit 0` / `{}`) when `python3` is absent; `run-hook.cmd` exits 0 silently with no bash. So the boot pipeline is strictly bash+python3, and on a shell-less runtime (iPad Claude Desktop) no `<cortex-session>` block is ever injected — `cortex-boot` routes to onboarding every session, `search.db` is never built, and Cortex degrades to a generic assistant with no memory. README markets Claude Desktop/Cowork as first-class, so this is an advertised scenario. The 14 MCP tools include no `get_boot_context` equivalent, so there is no fallback. **Downgraded from P0** because the failure is graceful degradation (behaves as uninstalled), not crash/data-loss. The ARG_MAX sub-claim (full prompt as argv in `user-prompt-submit`, swallowed by `|| true`) is real but only drops optional routing hints — the user's prompt still reaches the model.

- `hooks/session-start:22-24`, `hooks/post-tool-use:17-20`, `hooks/stop:16-19` (python3 bail)
- `hooks/run-hook.cmd:33-34` (silent exit when no bash)
- `skills/cortex-boot/SKILL.md:40,148` (no MCP fallback; routes to onboarding)
- `hooks/user-prompt-submit:33-40` (argv passing, `|| true`)

### T15 — Token-budget truncation and changelog tail silently degrade boot context
**Area:** boot · **Verdict:** confirmed (reproduced on user's real vault) · **Severity:** P1 (held) · **Avatars (4):** 02, 21, 27, 29

`apply_token_budget` computes `_budget.truncated` when fields are cut, but `session-start` never reads or emits it — so degradation is invisible and undiagnosable. **Reproduced live:** the user's real `personality.md` is 11,807 chars, exceeding the hardcoded 8000-char ceiling on its own; running the loader truncated personality to 7,741 chars and then *fully stubbed* `recent_activity`, `memory`, `learner_profile`, and `active_projects` (the bucket list that drives all project-name fuzzy matching). The session block then prints a misleading "Active projects: [truncated for token budget...]" and a fake "Recent activity:" stub line. Changelog tail is hardcoded `tail=15` with no config key.

- `hooks/lib/boot-context.py:265` `DEFAULT_BUDGET_CHARS=8000`; `:317-364` budget pass + `_budget.truncated`
- `hooks/session-start:28-31` (no `--budget-chars` override); `:49-112` (never reads `_budget`)
- `hooks/lib/boot-context.py:323,433` (`active_projects` lowest priority, L1/L2 only)
- `hooks/lib/boot-context.py:343-352` (L3 stub capped at 3 blockers/questions/decisions)
- `hooks/lib/boot-context.py:72,411` (changelog `tail=15` hardcoded)

---

## 5. P2 Findings (verified)

### T03 — Transcript speaker-label detection misses real-world export formats; misfires on metadata
**Verdict:** partial · **Severity:** P1 -> P2 · **Avatars (11):** 01, 02, 05, 07, 09, 13, 14, 17, 20, 21, 28

`grep -cE '^[A-Za-z]+: '` requires single-word, markup-free labels. Reproduced: Granola `**Ben:**` -> 0, Fathom `[00:01] Name:` -> 0, multi-word `First Last:` -> 0; a Zotero paste (`Author:`/`Title:`/`DOI:`) -> 21 false matches; a clinical `Client:`/`Therapist:` paste -> 17 matches. **Partial** because the hook only injects an *advisory* `<cortex-hint>`; the skill's own description names Granola/Fathom, so paste recognition is not guaranteed-broken, and the separate MCP-transcript path is unaffected. The false-positive direction (hard-routing bibliography/quote pastes to meeting filing at `confidence:high`) is the more concrete defect.

- `hooks/user-prompt-submit:60-68` (LINE_COUNT>=20 AND speaker regex >=3 -> hard route)
- `references/trigger-phrases.md` rows 12/14 (claims Granola/Fathom/Gong coverage not implemented)

### T05 — Embedding cold-start blocks first recall with no user-visible signal
**Verdict:** partial · **Severity:** P1 -> P2 · **Avatars (10):** 01, 02, 03, 05, 08, 13, 14, 17, 21, 23

`getExtractor()` lazy-loads `Xenova/all-MiniLM-L6-v2` on the first `embed()` call; `server.js` does no eager warming; `recall_related` has no timeout/AbortController. So the first ambient recall pays the full cold-start silently. **Partial / overstated:** model weights are locally cached after first-ever run (the 10-30s download is once-ever, not per-session); measured warm first-load was ~685ms, not 2-8s; and with no timeout, nothing is silently *dropped* — `embed()` simply blocks. Real one-time-per-process multi-second stall on a background call; daily-flow polish, not P1.

- `mcp-servers/cortex-vault/lib/embeddings.js:7-17` (lazy `extractorPromise`)
- `mcp-servers/cortex-vault/server.js:66-70` (no warm before transport connect)
- `tools/recall-related.js:61` (`await embed()`, no timeout)

### T06 — L3 read-only contract vs Tier-1 "always capture silently"
**Verdict:** partial · **Severity:** P0 -> P2 · **Avatars (7):** 01, 04, 06, 14, 15, 24, 29

The headline "no precedence rule" claim is **refuted**: `activation-levels.md:50-51` and `trigger-phrases.md:63` give explicit triggers a deterministic override at L3. The genuine narrower gap: *inferred* Tier-1 signals (no trigger phrase) at L3 — the write-path skill has no L3 read-only gate, and `cortex-update-context` Example 3 demonstrates an inferred scope-change written silently at L3, contradicting the stated read-only default. **Downgraded from P0** because there is no confidential-bucket mechanism in code (the privilege/clinical escalation is hypothetical) and over-capture is recoverable via the documented revert.

- `references/activation-levels.md:46-51` (L3 read-only default + explicit-trigger override)
- `references/capture-rules.md:33` (Tier 1 never asks)
- `skills/cortex-update-context/SKILL.md:182-201` (inferred L3 write example)

### T07 — recall_related has no scope/score enforcement
**Verdict:** partial · **Severity:** P0 -> P2 · **Avatars (7):** 06, 07, 09, 10, 15, 16, 28

Confirmed: `recall_related` queries the entire `vec_notes` table filtered only by `exclude_paths`; no scope/project param; `score = 1 - distance/2` so the 0.5 cutoff ~= cosine 0 (near-orthogonal); the 0.5 threshold is model-only prose, not server-side; results carry no project attribution. **Refuted P0 driver:** this is single-user, single-vault, local — recall surfaces the owner's *own* notes back to the owner, so it is a relevance/attribution annoyance, not a privilege/HIPAA disclosure. Per-project `vault_path` in the registry makes scoping feasible.

- `mcp-servers/cortex-vault/tools/recall-related.js:41-96` (all-notes query, no scope)
- `lib/indexer.js:10-19` (indexes all client folders)
- `skills/cortex-boot/SKILL.md:85` (score>0.5 is model-only)
- `recall-related.js:81-86` (no attribution field)

### T08 — Semantic index goes stale; external edits skip re-embed; no staleness warning
**Verdict:** partial · **Severity:** P1 -> P2 · **Avatars (7):** 02, 11, 18, 19, 21, 22, 29

Confirmed: re-embed fires only on Claude's own Write/Edit/Obsidian-MCP writes; no watcher, cron, or boot-time freshness check; `recall_related` returns `{count:0}` identically for empty-index and no-match (no `index_empty` flag); reindex requires `node` on PATH; full reindex is sequential with a no-op `onProgress`. **Partial / overstated:** the WAL race needs heavy simultaneous bulk writes (busy_timeout=5000 covers normal contention), and a dropped embedding self-heals on next edit — it is staleness/silence, not "corruption." Recoverable and lossless.

- `hooks/post-tool-use:194-210` (re-embed only on Claude writes, `|| true`)
- `lib/indexer.js:122-136` (sequential upsert); `reindex-vault.js:15` (no `onProgress`)
- `tools/recall-related.js:67-92` (empty vs no-match indistinguishable)
- `lib/search-db.js:19-20` (WAL + busy_timeout=5000)

### T10 — vault-path.js caches vault path for MCP process lifetime with no invalidation
**Verdict:** partial · **Severity:** P1 -> P2 · **Avatars (4):** 04, 13, 23, 27

Confirmed mechanism: `getVaultPath()` caches forever; `clearCache()` is only called by tests; the stdio MCP server is long-lived, so a mid-session `config.json` edit or vault move is invisible and all writes route to the stale path. **Partial:** there is no migration/relocate feature that rewrites `vault_path` mid-session, so the only realistic trigger is a manual edit/move without restart — an edge case, and the cached path was valid at cache time (no corruption). Cheap fix via mtime/TTL.

- `mcp-servers/cortex-vault/lib/vault-path.js:48-49` (cached forever); `:73-75` (`clearCache` test-only)

### T11 — Activation rarely escalates beyond L1 for common contexts
**Verdict:** partial · **Severity:** P1 -> P2 · **Avatars (6):** 14, 15, 19, 23, 25, 30

Confirmed: `resolve_cwd` reaches L3 only on exact `repo_paths` ancestor match and stops the walk at `$HOME`; no git-worktree resolution; no `default_project` config; and a real resolver divergence — `register-repo.js` stores raw paths, the Python boot resolver uses `realpath`, the Node MCP resolver uses `normalize`, and the two walkers stop at different roots ($HOME vs filesystem root). **Refuted headline:** "never escalates beyond L1 all day" — `activation-levels.md:57-74` specifies conversational escalation (L1->L2 on project mention, ->L3 on "let's work on X") via `read_hub`, which the boot-time freeze does not prevent. Impact narrower than silent-all-day.

- `hooks/lib/boot-context.py:121-154` (exact match, walk stops at $HOME)
- `mcp-servers/cortex-vault/lib/registry.js:105,116-126` (`normalize` vs Python `realpath`)
- `references/activation-levels.md:57-74` (conversational escalation exists by design)

### T13 — Memory subsystem partly inert and unbounded
**Verdict:** partial · **Severity:** P1 -> P2 · **Avatars (5):** 05, 09, 14, 16, 19

Confirmed: the stop hook flushes `pending-memory.json` -> `memory.md`, but the *only* writer of `pending-memory.json` in the repo is a test fixture — no MCP tool, skill, or workflow produces it, so the long-term memory accumulation path is effectively inert despite `progressive-features.md` declaring `memory_management` always-active. Also confirmed: silent 100-line tail cap, no dedup, unused `section` field. **Partial / overstated:** "client facts never persisted" is too strong — `cortex-update-context` routes client preferences to the hub + `Changelog.md`, which persist; only the global `memory.md` growth path is dead.

- `hooks/stop:138-170` (append-only flush, no dedup, `section` unused); `:101` (reads `pending-memory.json`)
- `hooks/lib/boot-context.py:45-57` (silent 100-line tail cap)
- only producer: `tests/run-hook-tests.sh:162`

### T17 — Undisclosed network calls contradict the offline promise
**Verdict:** partial · **Severity:** P0 -> P2 · **Avatars (2):** 10, 24

**Largely refuted privacy framing:** no vault/PHI/user data is sent to any third party. Boot-context injection of bucket names + changelog NOTE goes to Anthropic, but that is the product's normal operation (surfacing the user's own context to their own Claude), not exfiltration; the NOTE field is structured routing metadata; `_signals.log` is local, taxonomy-tags-only, and gated on coach init. **Genuine, fixable items:** (1) `embeddings.js` sets `allowLocalModels=true` but never `allowRemoteModels=false` and pins no cache path, so a fresh install fetches model weights from huggingface.co on first embed — directly contradicting README's "no data leaves your machine"; (2) `bootstrap.js` runs a silent `npm install` on MCP startup. Both fetch code/weights, not user data — transparency/offline-robustness defects, not a privacy breach.

- `mcp-servers/cortex-vault/lib/embeddings.js:13` (`allowRemoteModels` not disabled)
- `mcp-servers/cortex-vault/bootstrap.js:38-48` (silent `npm install`)
- `README.md:150` ("No API key, no cloud, no data leaves your machine")

### T20 — User-facing surfaces not fully persona-agnostic
**Verdict:** partial · **Severity:** P1 -> P2 · **Avatars (4):** 07, 11, 14, 18

**Largely refuted accessibility/jargon framing:** `cortex-check-status/SKILL.md` already mandates prose ("2-5 sentences", "not a report") and `read_hub` JSON is model-consumed, not surfaced raw; isError strings are plain English; repo-link and emoji prompts are documented as optional. **Genuine bug:** `scaffold-project.js:286` hardcodes `enum:['Personal','TBL']` and lines 71-81 hardcode `Work/Personal` paths — Ben-specific, even though the SKILL layer says "read personality.md, never hardcode." `#domain/` taxonomy in `vault-conventions.md:25` is web-dev-only.

- `mcp-servers/cortex-vault/tools/scaffold-project.js:71-81,286` (hardcoded category enum/paths)
- `references/vault-conventions.md:25` (web-dev-only `#domain/`)

---

## 6. P2 Findings (synthesis, not independently verified)

These three were rated P2 in synthesis and were not part of the P0/P1 adversarial pass; treat their severity as provisional.

### T14 — thread_meeting requires 3+ notes before linking
**Area:** meeting · **Avatars (10):** 04, 05, 08, 16, 23, 25, 26, 27, 29, 30
First two meetings of every new series are silent orphans (`thread-meeting.js:194-200`); the skip is not surfaced in the announce line. Tool hard-errors when the new note isn't yet on disk (`:219-229`), an undocumented precondition.

### T18 — Capture writes lack a confirmation/dry-run mode; per-write hints undermine batching
**Area:** capture · **Avatars (2):** 24, 28
No `write_mode` (silent/confirm/explicit-only) switch; `post-tool-use` injects one hint per write, defeating the documented batching rule; stop-hook flush reports count only; bare `*reusable*`/`*explain*` substrings false-fire.

### T21 — Dormant-feature and coaching-signal pipelines are stubs
**Area:** boot · **Avatars (5):** 07, 15, 22, 26, 30
`check_dormant_features` hardcodes a single `weekly_review` check and ignores 8 declared features (`boot-context.py:367-378`); no `last_suggested` guard (re-fires every session); teaching-moment hints are never written to `pending-signals.json`, so the stop-hook flush and `cortex-coach` have no producer.

---

## 7. P3 / Refuted

### T04 — Capture trigger phrase list diverges from docs and natural language
**Verdict:** partial · **Severity:** P1 -> P3.** Two narrow doc/code divergences are real ("we got <X>" and "file as a reference" documented but unimplemented; curly-apostrophe U+2019 gap). But the hook emits a non-binding hint, not a capture gate; the semantic ambient watch in `capture-rules.md` is the real backstop, so "silent drift / resolved blockers re-surface" does not follow. Most cited "natural phrasings" are undocumented feature requests, not divergences.

### T16 — Concurrent/atomicity gaps in vault writes
**Verdict:** partial · **Severity:** P1 -> P3.** The genuine defect — no cross-process lock on hub read-modify-write (last-writer-wins) — is real but narrow (requires two simultaneous writers to the same hub; file never corrupted, rename is atomic). Two of four evidence points are **factually wrong**: the stop-hook inline echo exactly matches `changelog-format.js` (no format drift), and the memory flush is intentionally append-only (os.replace is a non-fix).

### T19 — Status/read-side coverage gaps
**Verdict:** partial · **Severity:** P1 -> P3.** Headline P1 justifications are **false**: `list-projects.js` exists, is registered, and is already a single-pass batch-status tool; the "nonexistent list_projects" and "N sequential read_hub" claims are contradicted by code. What survives is cosmetic: L1/L2 boot surfaces bucket names not project names; the status case block omits "on track"/"catch me up"/"what happened"; `cortex-check-status/SKILL.md:23` advertises an unrouted trigger.

### T09 — Session-cache global singletons — REFUTED
**Severity:** P0 -> P3 (hygiene only).** The two load-bearing P0 consequences do not occur in shipping code. (1) **No per-vault misrouting:** the cached path is the single *global* `config.vault_path` (config confirms one vault: `/Users/benhungerford/Documents/The Vault`), so two concurrent session-starts write the identical string — there is no "other vault" to misroute to, and `post-tool-use` additionally guards that the edited file is inside the vault. (2) **No memory data loss:** `pending-memory.json` has zero production writers (only a test fixture), so the flush path is orphaned/dead code. `coach-active.flag` only flips a cosmetic source tag. The un-namespaced singletons remain a latent code smell worth namespacing, but no P0 mechanism is reachable.

---

## 8. Cross-Cutting Patterns

1. **Doc/code drift is systemic.** `trigger-phrases.md`, `capture-rules.md`, `activation-levels.md`, and several `SKILL.md`s repeatedly document behavior the hooks/tools do not implement. A CI check diffing specs against implementations would catch most capture/status misses (and would have caught the false T19 claim that `list_projects` was missing — it exists; the *docs* and *hook patterns* are what drifted).

2. **Multiple representations of one concept never converge.** Hub schema (3 parsers — T01), path normalization (`realpath` vs `normalize` — T11), and the boot/read split each have divergent implementations. A single shared module per concept with a round-trip test is the recurring fix.

3. **Silent failure is the dominant failure mode.** Missed captures, empty blockers (T01), stale/empty index (T08), cold-start stalls (T05), and budget truncation (T15) all happen with no user-visible signal. Lightweight one-line boot/confirmation notices convert most silent failures into diagnosable ones — the single highest-leverage cross-cutting fix.

4. **The hook layer hardcodes one persona.** English-native literal triggers, exact `repo_paths` matching, python3/node/bash availability, and TBL/Personal/web-dev taxonomy all break for ESL, iPad/Desktop, non-developer, and offline users (T03, T11, T12, T17, T20).

5. **The embedding pipeline is a shared lever.** Cold-start latency (T05), the CDN weight fetch (T17), and stale/empty index (T08) all hinge on it. Warming it eagerly, pinning it offline, and giving it freshness/scope/score controls addresses several findings at once.

---

## 9. Verification Verdict Table (P0/P1 themes)

| Theme | Original | Corrected | Verdict | One-line reason |
|-------|----------|-----------|---------|-----------------|
| T01 | P0 | P1 | confirmed | Schema fork real; silent wrong-data, not total outage |
| T02 | P1 | P1 | confirmed | Resolve rewrites in place vs documented remove-row rule |
| T03 | P1 | P2 | partial | Regex/misfire real; hook is advisory, MCP path intact |
| T04 | P1 | P3 | partial | Narrow doc drift; ambient watch is the backstop |
| T05 | P1 | P2 | partial | Cold-start real but once-ever download, no silent drops |
| T06 | P0 | P2 | partial | Precedence rule exists; only inferred-L3 edge is real |
| T07 | P0 | P2 | partial | Single-user own-notes recall — relevance bug, not leak |
| T08 | P1 | P2 | partial | Staleness real; "corrupt" unsupported, self-heals |
| T09 | P0 | P3 | refuted | One global vault; memory write path is dead code |
| T10 | P1 | P2 | partial | Real but edge-triggered (manual config edit/move) |
| T11 | P1 | P2 | partial | cwd gaps real; conversational escalation exists |
| T12 | P0 | P1 | confirmed | Shell-less platform = no boot, graceful degradation |
| T13 | P1 | P2 | partial | memory.md growth inert; hub path still persists facts |
| T15 | P1 | P1 | confirmed | Reproduced on real vault; truncation fully silent |
| T16 | P1 | P3 | partial | Lock gap narrow; 2 of 4 evidence points wrong |
| T17 | P0 | P2 | partial | No data leak; weight-fetch + npm-install transparency |
| T19 | P1 | P3 | partial | list_projects exists; only cosmetic phrasing gaps |
| T20 | P1 | P2 | partial | Prose rules exist; scaffold hardcoding is the real bug |

(T14, T18, T21 were synthesis-only P2 and not part of the P0/P1 adversarial pass.)

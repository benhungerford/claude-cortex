# Claude Cortex — Improvement Foundation

**From:** 30-avatar daily-use audit, 2026-06-01
**Plugin version:** v1.4.0
**Companion:** [`FINDINGS.md`](./FINDINGS.md) (full evidence + verification verdicts)

This is a foundation to build from, not a finished spec. Each item ties to real files, names a proposed direction, gives a rough effort (S/M/L), and a success signal you can test against.

---

## Executive Summary

The audit stress-tested Cortex as a daily driver across 30 personas, then adversarially re-verified every high-severity finding against the source. The headline result: **there are no true P0s.** Six of the seven originally-flagged P0s were privilege/PHI/data-loss escalations that assumed a multi-tenant, networked, or memory-active architecture Cortex does not have — it is single-user, single-vault, and local, so recall surfaces the owner's own notes to the owner and the "data leak" surfaces are model-context injection that is the product working as designed.

What remains is real and worth fixing: **one structural correctness bug (T01, hub schema forked across three parsers) plus three confirmed daily defects (T02 resolve-leaves-strikethrough, T12 boot dies on shell-less platforms, T15 silent budget truncation).** The deepest pattern is *silent failure* — empty blockers, stale indexes, truncated context, and missed captures all happen with no signal, so users blame the model and cannot self-diagnose. The second pattern is *doc/code drift* and *forked representations of one concept* (hub schema, path normalization, boot vs read parsers). The cheapest high-leverage investment is a thin signaling layer (one-line boot/confirmation notices) plus a single canonical module per forked concept with a round-trip test, plus a CI check that diffs specs against implementations. Strengths to protect: the L1/L2/L3 activation model, the L3 one-liner, the tier-based capture philosophy, the clean MCP tool boundary, and `boot-context.py`'s `parse_hub` as the canonical hub reader.

---

## Roadmap

### Wave 1 — Correctness + signaling (P1 + structural)

The smallest set of changes that stop silent wrong-data and platform death. Do these first.

#### W1.1 — Converge the hub schema on one canonical parser (T01)
- **Problem:** Three parsers disagree on hub structure (checkbox vs combined pipe-table). For any hub, either the L3 boot greeting or `cortex-check-status` silently reports zero blockers/questions.
- **Direction:** Pick the pipe-table (richer; `boot-context.py`'s `parse_hub` is the reliable reference) as canonical. Define it once in a `hub-schema.md` spec. Build a shared parse/serialize module and route all five paths through it. Have `scaffold-project.js` consume `blank-template.md` instead of hardcoding sections.
- **Code:** `mcp-servers/cortex-vault/tools/read-hub.js:24-62`, `hooks/lib/boot-context.py:205-224`, `assets/blank-template.md:70-73`, `mcp-servers/cortex-vault/tools/scaffold-project.js:177-184`, `mcp-servers/cortex-vault/tools/open-question.js:32-59`.
- **Effort:** L (cross-language; the JS side and Python side both need the same grammar, or boot calls a shared MCP read path — see W1.3).
- **Success signal:** Round-trip integration test — scaffold a hub, add a blocker via `open_question`, assert `read_hub` and `parse_hub` return identical non-empty blocker sets.

#### W1.2 — Make open_question resolve remove the row (T02)
- **Problem:** Resolve rewrites `- [x] ... — Resolved: ...` in place, contradicting the Blocker-Resolved Rule; resolved rows accumulate in Obsidian but vanish from MCP reads.
- **Direction:** Splice the matched line out entirely; return the removed text so the caller logs it to the project `Changelog.md` (not just `_changelog.txt`). Detect multiple substring matches and return an error listing candidates rather than resolving the first.
- **Code:** `mcp-servers/cortex-vault/tools/open-question.js:66-79` (rewrite), `:70` (findIndex), `:179-189` (changelog target); rule at `skills/cortex-update-context/SKILL.md:88-97`.
- **Effort:** S.
- **Success signal:** Resolving a blocker removes the row from the hub file on disk; `read_hub` and Obsidian agree; ambiguous text returns a candidate list, not a wrong resolution.

#### W1.3 — MCP-first boot fallback for shell-less platforms (T12)
- **Problem:** Boot is bash+python3 only; on iPad/Cowork Desktop no `<cortex-session>` block is injected, so every session routes to onboarding and `search.db` never builds.
- **Direction:** Add a `get_boot_context` MCP tool returning the same JSON as `boot-context.py`. Have `cortex-boot` Step 1 call it when no `<cortex-session>` block is present, before falling back to onboarding. Keep hooks as the fast path. (This tool also becomes the shared boot reader that lets W1.1 converge without duplicating the parser in two languages.) Pipe `$INPUT` via stdin to python3 in `user-prompt-submit` instead of argv to remove the ARG_MAX swallow.
- **Code:** `hooks/session-start:22-24`, `hooks/post-tool-use:17-20`, `hooks/stop:16-19`, `skills/cortex-boot/SKILL.md:40,148`, `hooks/user-prompt-submit:33-40`; new `mcp-servers/cortex-vault/tools/get-boot-context.js`.
- **Effort:** L.
- **Success signal:** On a runtime with no python3/bash, `cortex-boot` still produces an L1+ greeting with project context via MCP; onboarding is not re-triggered for an existing vault.

#### W1.4 — Surface budget truncation; reserve the bucket list (T15)
- **Problem:** `_budget.truncated` is computed but never emitted; on the user's real 11.8k-char personality.md, the bucket list (project-name anchor) and recent activity are silently stubbed, and a fake "Recent activity:" line prints.
- **Direction:** Extract the bucket list as a fixed-priority, budget-reserved field before personality fill. When `_budget.truncated` is non-empty, emit one line in the session block ("Context budget: N fields truncated — say 'read hub' for full state"). Expose `budget_chars` as a config key. Make the changelog tail configurable / time-bound to today.
- **Code:** `hooks/lib/boot-context.py:265,317-364,323,433,72,411`, `hooks/session-start:28-31,49-112`.
- **Effort:** M.
- **Success signal:** On the real vault, the bucket list survives truncation, no fake stub line appears, and a one-line truncation notice shows when fields are cut.

#### W1.5 — Cross-cutting: a thin signaling layer + spec-vs-code CI
- **Problem:** Silent failure is the dominant mode; doc/code drift is systemic.
- **Direction:** (a) Add one-line boot/confirmation notices for the common silent states (truncation done in W1.4; index empty/stale in W2.x; recall init in W2.x). (b) Add a CI check that diffs `references/trigger-phrases.md` rows against `user-prompt-submit` patterns and skill-advertised tool names against the registered MCP tool list — this would have caught the false "list_projects missing" claim and the real "we got X" / "is X on track" drift.
- **Code:** `references/trigger-phrases.md`, `hooks/user-prompt-submit`, `mcp-servers/cortex-vault/server.js`, new `tests/spec-drift.test.js`.
- **Effort:** M.
- **Success signal:** CI fails when a documented trigger or advertised tool has no implementation.

---

### Wave 2 — Robustness + persona reach (P2)

#### W2.1 — Eager-warm the embedder + timeout recall (T05)
- **Direction:** Fire-and-forget `getExtractor().catch(()=>{})` in `server.js main()` before connecting transport. Wrap `embed()` in `recall_related` with a timeout returning empty + a log. Surface a one-time "(initializing semantic search)" note if init exceeds ~2s.
- **Code:** `mcp-servers/cortex-vault/lib/embeddings.js:7-17`, `server.js:66-70`, `tools/recall-related.js:61`.
- **Effort:** S. **Success signal:** First recall of a session returns within warm latency; no multi-second background stall on the first substantive turn.

#### W2.2 — Index freshness + empty-vs-no-match signal (T08)
- **Direction:** At boot, compare index freshness (MAX(updated) or `_changelog.txt` mtime) and emit a one-line "index is N hours old / empty — run /cortex-index". Add an `index_empty` flag (`SELECT count(*)`) the skill surfaces once. Replace fire-and-forget per-write spawns with a debounced serial reindex queue drained in the stop hook; stop swallowing errors. Wire `onProgress` to stderr; add a periodic cron reindex.
- **Code:** `hooks/post-tool-use:194-210`, `lib/indexer.js:122-136`, `reindex-vault.js:15`, `tools/recall-related.js:67-92`, `lib/search-db.js:19-20`.
- **Effort:** M-L. **Success signal:** A never-built index shows a distinct "empty" notice; external Obsidian edits get reindexed within a session boundary; large rebuild streams progress.

#### W2.3 — recall_related scope + server-side min_score + attribution (T07)
- **Direction:** Add `include_paths`/`scope` and `min_score` (default ~0.7) params, enforced server-side. In `cortex-boot` Step 6 pass `scope=active project's vault_path` at L3. Add a project field (first path segment) to each result and surface it ("Worth knowing (FKT): [[...]]"). Raise the behavioral threshold in `SKILL.md` to match.
- **Code:** `tools/recall-related.js:41-96,81-86`, `lib/indexer.js:10-19`, `skills/cortex-boot/SKILL.md:85`.
- **Effort:** M. **Success signal:** A scoped recall returns only in-scope notes; low-score noise is filtered server-side; hints carry project attribution. *(Framed as relevance/attribution, not a privilege fix — see open question Q1.)*

#### W2.4 — Activation: worktree resolution, default_project, unified path normalization (T11)
- **Direction:** On exact-walk-up failure, resolve git worktree markers (`git rev-parse --git-common-dir`) and retry from the main worktree root. Add a `default_project` config (set in onboarding / `/set-default-project`) for Desktop/iPad. Unify both resolvers on `realpath`+`normpath` with a paired-comment. Emit a one-line warning when L1 is computed but a Cortex stub/vault is found.
- **Code:** `hooks/lib/boot-context.py:121-154`, `mcp-servers/cortex-vault/lib/registry.js:105,116-126`.
- **Effort:** M. **Success signal:** A registered repo opened via a worktree or symlink resolves to L3; Desktop/iPad sessions reach at least L2 via `default_project`.

#### W2.5 — Inferred-Tier-1-at-L3 reconciliation (T06)
- **Direction:** Add an explicit reconciliation rule to both docs: at L3, explicit triggers proceed as Tier 1 (already the rule); ambient *inferred* Tier 1 signals require a one-line confirm before writing. Append a one-time "say 'log that' to save decisions" hint to the L3 opener.
- **Code:** `references/activation-levels.md:46-51`, `references/capture-rules.md:33`, `skills/cortex-update-context/SKILL.md:182-201`, `skills/cortex-boot` L3 opener.
- **Effort:** S (docs/prompt). **Success signal:** An inferred decision at L3 prompts a one-line confirm rather than writing silently.

#### W2.6 — vault-path mtime invalidation (T10)
- **Direction:** Stat `config.json` mtime on each `getVaultPath()` (or a ~60s TTL) and wire the existing `clearCache()` to it.
- **Code:** `mcp-servers/cortex-vault/lib/vault-path.js:48-49,73-75`.
- **Effort:** S. **Success signal:** Editing `config.json` mid-session reroutes writes without an app restart.

#### W2.7 — A real memory write path (T13)
- **Direction:** Add an `update_memory`/`queue_memory` MCP tool that appends to the pending queue; reference it in `capture-rules.md` and `cortex-update-context` for the client-preference Tier 1 type. Dedup verbatim lines; use the `section` field for headers; emit an eviction notice past ~80 lines; add `/cortex-compact-memory`.
- **Code:** `hooks/stop:138-170`, `hooks/lib/boot-context.py:45-57`; new `tools/update-memory.js`.
- **Effort:** M. **Success signal:** A stated client preference survives across sessions in `memory.md` on all platforms; memory.md does not silently drop old facts without notice.

#### W2.8 — Offline-pin the embedding model + disclose npm install (T17)
- **Direction:** Set `env.allowRemoteModels=false` and pin a `cacheDir`/`localModelPath`; pre-download or ship weights, with a human-readable offline error. Do not run `npm install` during a user session without consent — pre-bundle `node_modules` or fail with a clear message. Update README's offline claim to match reality.
- **Code:** `mcp-servers/cortex-vault/lib/embeddings.js:13`, `bootstrap.js:38-48`, `README.md:150`.
- **Effort:** M. **Success signal:** A fully-offline install does no outbound network call, or fails with a clear actionable message; README claim is accurate.

#### W2.9 — Transcript detection: broaden + density discriminator (T03)
- **Direction:** Broaden the regex to `^(\*\*)?[A-Za-z][A-Za-z .\-]*:(\*\*)? ` plus a `[HH:MM] Name:` variant and bracket/dash forms. Add a density discriminator (speaker lines >=25% of total) or a metadata-key denylist (Author/Title/DOI/Year/Journal) to kill bibliography/quote false positives. Raw pastes lacking a temporal marker -> `confidence:medium` so the skill asks "file or just context?".
- **Code:** `hooks/user-prompt-submit:60-68`, `references/trigger-phrases.md` rows 12/14.
- **Effort:** M. **Success signal:** Granola/Fathom/multi-word pastes route correctly; Zotero/clinical pastes do not hard-route to meeting filing.

#### W2.10 — Persona-agnostic scaffold (T20)
- **Direction:** Make `scaffold_project` read `personality.md` buckets for a freeform category (TBL/Personal as defaults, not a hardcoded enum) and stop hardcoding `Work/Personal` paths. Make `#domain/` user-defined in `personality.md`.
- **Code:** `mcp-servers/cortex-vault/tools/scaffold-project.js:71-81,286`, `references/vault-conventions.md:25`.
- **Effort:** M. **Success signal:** A non-Ben vault structure scaffolds projects into the correct tree without code edits.

---

### Wave 3 — Polish (P2 synthesis-only + P3)

- **W3.1 — thread_meeting threshold -> 2 + surface skip (T14).** Lower the link threshold to 2; surface the skip state in the announce line; add a short retry (or document the on-disk precondition) for the not-yet-written case. `thread-meeting.js:194-200,219-229`. Effort S.
- **W3.2 — write_mode + batched hints (T18).** Add `write_mode` (silent default / confirm / explicit-only); track per-turn write count and emit one batched summary hint; include flushed content in the stop-hook summary; require a phrase anchor alongside bare `reusable`/`explain`. `hooks/post-tool-use:213-220`, `hooks/stop:138-193`, `hooks/user-prompt-submit:127,175`. Effort M.
- **W3.3 — Generalize dormant features + real signal producer (T21).** Iterate all dormant features from the YAML; write per-feature `last_suggested` and suppress for ~7 days; make `user-prompt-submit` append teaching-moment entries to `pending-signals.json`. `boot-context.py:367-378`, `user-prompt-submit:172-178`, `hooks/stop:51-97`. Effort M.
- **W3.4 — Trigger-phrase + apostrophe normalization (T04).** Add documented-but-missing triggers ("we got X", "file as a reference"); normalize curly U+2019 to straight apostrophes in the Python extraction step. Routed soft matches at `confidence:medium`. `user-prompt-submit:50,93,105,127`. Effort S. (Mostly subsumed by W1.5's CI check.)
- **W3.5 — Status phrasing coverage (T19).** Extend the status case block with "on track"/"catch me up"/"what happened" + ESL forms; include project names (not just bucket names) in the L1/L2 boot block. `user-prompt-submit:147-155`, `boot-context.py:432-433`. Effort S.
- **W3.6 — Namespace session-cache singletons (T09, hygiene).** Namespace `session-cache` files by session ID or cwd hash; each stop hook reads/deletes only its own namespace; sweep namespaces >24h; truncate `vault-path.txt` at the top of `session-start`. Note: refuted as a P0 (one global vault, dead memory path), but worth doing as latent-bug hygiene before any future multi-vault support. `hooks/session-start:40-45`, `hooks/post-tool-use:69-72`, `hooks/stop:101-106`. Effort M.
- **W3.7 — Hub write locking (T16, hygiene).** Add a per-file advisory lock or optimistic concurrency (hash-at-read, re-read-before-write, abort on conflict) around hub read-modify-write. Narrow (two simultaneous writers to one hub), but the only genuine survivor of T16. `mcp-servers/cortex-vault/lib/file-ops.js:13-19`. Effort M.

---

## Guardrails — Must Not Regress

These are validated strengths. Any change above must preserve them.

1. **The L1/L2/L3 activation model.** Personas across the spectrum understood and relied on it. The failures are in *enforcement and signaling*, not the concept — do not redesign the model.
2. **`boot-context.py`'s `parse_hub` is the canonical hub reader.** Converge the other parsers *onto* it (W1.1); do not fork it further.
3. **The L3 one-liner ("Project — Stage. N blockers. Ready.").** Multiple personas cited this brevity as the core value. Notices added in W1.4/W2.x must be one line and must not bloat the opener.
4. **post-tool-use's delegation to `append-changelog-cli.js` / `changelog-format.js`.** This is the correct shared-formatter pattern. The stop hook should adopt it, not abandon it (and per T16 verification, the stop-hook echo already matches the format — do not "fix" what isn't broken).
5. **The tier-based capture model + batched one-line "Invisible Rule" confirmation.** Sound and well-liked. The work is reconciling it with activation levels and adding *optional* review (W2.5, W3.2), not replacing it.
6. **The MCP tool boundary.** Clean and well-factored; it is the universal fallback that makes W1.3 (MCP-first boot) feasible. Extend it; do not bypass it.
7. **Atomic tmp+rename writes + SQLite WAL/busy_timeout.** Concurrency was considered. Add cross-process locking and namespacing to finish the job (W3.6, W3.7) — keep the atomic primitives.

---

## Open Questions for Ben

1. **Is multi-vault / multi-tenant ever in scope?** Most of the refuted P0 severity (T07 privilege, T09 misroute) hinged on it. If Cortex stays single-user/single-vault, W2.3 is a relevance feature, not a security fix, and W3.6 is pure hygiene. If you intend to support shared/team vaults (avatar 27) or per-client confidential buckets (avatars 06/10), several P2s re-escalate and a confidential-bucket mechanism becomes a real feature, not a doc note.
   - **DECISION (2026-06-01, Ben):** Multi-vault *possibly* in scope long-term, **not near future. Teams explicitly out of scope.** Consequence: T07/W2.3 = relevance/attribution feature (not security); W3.6 = latent-bug hygiene only; per-client confidential buckets stay a doc note for now. Build the converged/forked-out modules (W1.1, W2.4 path normalization, W3.6 namespacing) so they *don't block* a future multi-vault, but do not invest in team/multi-tenant machinery now.
2. **Hub schema: pipe-table or checkbox as canonical (W1.1)?** The audit recommends pipe-table (richer, already the boot reference). This is a one-way migration decision — existing scaffolded hubs use checkboxes and would need a migration pass. Confirm direction before the shared module lands.
3. **Boot architecture: MCP-first, or keep hooks primary with MCP fallback (W1.3)?** MCP-first fixes iPad/Desktop cleanly but changes the boot critical path. Recommendation is hooks-fast-path + MCP-fallback, but it is your call how much to invest in shell-less platforms given the README markets them as first-class.
4. **Default write posture (W2.5/W3.2).** Should L3 inferred Tier 1 confirm-before-write by default, or only under a privacy/`confirm` mode? Affects the silent-capture value prop that developer avatars (01, 04, 15) liked.
5. **Offline stance (W2.8).** Do you want to *ship* the ~86MB model weights in the plugin (bigger install, truly offline) or pre-download on first run with a clear consent/error message? This trades install size against the README's "no data leaves your machine" promise.
6. **Persona-config surface (W2.4/W2.10).** A small `cortex-config` (default_project, bucket terms, domain taxonomy, write_mode, budget_chars, privacy flags) would absorb T11/T15/T17/T18/T20 into one onboarding-set file. Worth defining the schema before building these piecemeal?

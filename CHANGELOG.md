# Claude Cortex Plugin — Changelog

## v1.4.2 — 2026-06-25

**Daily-use audit — Wave 3 (polish).**

- **W3.1 `thread_meeting`:** series-link threshold 3→2; structured JSON skip states; "file not on disk yet" downgraded from hard error to retryable skip.
- **W3.2 capture:** write modes (silent/confirm/explicit-only); per-turn batched capture hint instead of per-write spam; stop-hook surfaces flushed memory content.
- **W3.3 dormant features:** iterate all features declared in `personality.md` (was hardcoded `weekly_review`) with 7-day per-feature suppression; `user-prompt-submit` writes real teaching signals to `pending-signals.json`.
- **W3.4 triggers:** curly-quote normalization; new "we got X" / "file as a reference" triggers; bare "reusable" now requires a phrase anchor.
- **W3.5 status + boot:** more status phrasings ("on track", "catch me up", ESL forms); project names surfaced alongside buckets in L1/L2 boot.
- **W3.6 hygiene:** session-cache singletons namespaced per session; stale namespaces (>24h) swept.
- **W3.7 concurrency:** hub writes use `updateFileAtomic` + `ConcurrencyError` (`O_EXCL` lock + sha256 CAS); `open_question` read-modify-write now atomic with retries.

## v1.4.1 — 2026-06-24

**Cowork / hookless-surface reliability.**

- MCP server **auto-installs missing dependencies on launch** (announced on stderr, public npm packages only, no vault data sent) so the tools work in no-terminal surfaces like Cowork. Opt out with `CORTEX_SKIP_NPM_INSTALL=1`. Replaces the previous consent-gated fail-fast as the default.
- `recall_related` / `search_vault` **self-heal a stale semantic index**: when the freshness gate reports drift, they run the incremental indexer (hash-skips unchanged notes) before querying, so recent edits are found without the `post-tool-use` re-embed hook (which never fires on hookless surfaces). Opt out with `CORTEX_NO_AUTO_REINDEX=1`.
- `cortex-boot`: new **Step 1b hookless-surface maintenance contract** — when booted via the `get_boot_context` MCP fallback (hooks not running), the model appends the changelog after direct vault writes and relies on search self-heal for re-embedding.
- Docs: corrected README (ONNX weight is committed, 16 MCP tools, auto-install behavior); added v1.4.0 + v1.4.1 to version history.
- New self-heal regression test (`tests/self-heal-index.test.js`).

## v1.4.0 — 2026-05-09

**Onboarding rewrite + Q1 hardening + Q2 foundations.**

Onboarding:
- Comprehensive onboarding rewrite from 100-profile audit addressing 31 systemic gaps
- Adaptive tone register (4 levels: warm/terse/casual/formal) with separate trust register
- Surface awareness: Claude Code CLI vs Claude Desktop branching, iPad hard-pivot
- Compliance auto-detection for 50+ regulatory regimes (HIPAA, GDPR, FERPA, FINRA, etc.)
- Multi-axis schema: `secondary_axes` as list, per-bucket compliance variation, 3-level hierarchy support
- Three build modes: fresh / sandbox / metadata-only for existing vault integration
- Cloud-sync collision detection, IT/DLP awareness, accessibility across 5 dimensions
- ESL idiom screening, minor user protections, co-installer acknowledgment
- Expanded failure mode table covering 30+ edge cases

Q1 — Hardening:
- Path-traversal guard: `resolveInsideVault()` wired into 7 MCP tools
- Cross-platform hook guards: `command -v python3` gating on all 4 hooks
- `boot-context.py`: `encoding="utf-8"` on all `open()` calls with `UnicodeDecodeError` handling
- `search-db.js`: `journal_mode=WAL` + `busy_timeout=5000` for concurrent access
- Dead code removal: session-start trigger-phrase cache (never read)
- `install-desktop.sh`: reads version from `plugin.json` instead of hardcoded value

Q2 — Foundations:
- Registry reconciliation: `<vault>/.claude/cortex/registry.json` as single source of truth
- New `register_repo` MCP tool (14 tools total)
- Shared `lib/registry.js` for load/save/lookup with legacy `_repo_registry.json` fallback
- Changelog write chokepoint: `lib/changelog-format.js` with `formatChangelogEntry()`
- `bin/append-changelog-cli.js` Node helper for hooks
- Token-budgeted boot: `boot-context.py --budget-chars` (default ~8000 chars ≈ 2000 tokens)
- 119/119 MCP tests, 20/20 hook tests

## v1.3.1 — 2026-04-19

**Auto-install MCP dependencies on launch.**

- New `mcp-servers/cortex-vault/bootstrap.js` wrapper is now the entry point the MCP client invokes. Before loading the server, it verifies required deps (`@modelcontextprotocol/sdk`, `@huggingface/transformers`, `better-sqlite3`, `sqlite-vec`, `js-yaml`) and runs `npm install` if any are missing.
- Survives plugin cache refreshes — Claude Code periodically re-extracts the plugin source, which was wiping `node_modules/` and silently breaking every cortex-vault MCP tool until the user manually reinstalled.
- Zero overhead on happy path (a few `fs.existsSync` checks). Slow only on first post-refresh launch while deps install.
- `.mcp.json` now points at `bootstrap.js` instead of `server.js`.
- New `lib/bootstrap-check.js` with `needsInstall()` — extracted for testability. Covered by 5 unit tests.

Fixes the silent post-update failure observed on the v1.3.0 rollout.

## v1.3.0 — 2026-04-19

**Semantic search + ambient recall.**

- `cortex-vault` MCP server gains 3 new tools: `search_vault`, `recall_related`, `reindex_vault` (13 total)
- Local embeddings via `@huggingface/transformers` running `all-MiniLM-L6-v2` (384-dim, ~22MB, no API key, offline)
- Vector index stored in SQLite + `sqlite-vec` at `{vault}/.cortex/search.db`
- New `/cortex-index` slash command to rebuild the index on demand
- `post-tool-use` hook auto-re-embeds any `.md` file written or edited inside the vault (silent, fire-and-forget)
- `cortex-boot` skill gains a "Step 6 — Ambient recall" contract: Claude now proactively surfaces semantically related prior vault notes when the user starts a task, names a vendor/tool, or hits a blocker
- Source inspiration: MemPalace (items #1 semantic search and #4 cross-project discovery)

## v1.1.0 — 2026-04-10

**Boot pipeline rewrite + no-permission boot.**

- `cortex-boot` rewritten as zero-read interpreter — reads nothing itself, operates entirely on pre-loaded `<cortex-session>` block from the session hook
- `session-start` hook rewritten to use `boot-context.py` module for vault reading
- `boot-context.py` with core vault reading, hub parsing, CWD resolution via registry lookup, and dormant feature detection
- L1/L2/L3 test suites for boot-context pipeline
- `cortex-extend` skill for creating custom companion plugins
- No-permission boot: L1 activation works without any file-read approvals
- Marketplace naming fix to match GitHub owner-repo convention
- Documentation: activation levels, getting started guide, repo-claude-stub updates

## v1.0.0 — 2026-04-09

**Stage 4: cortex-vault MCP server.**

- `cortex-vault` MCP server with 10 tools enforcing vault conventions at the tool layer:
  `append_changelog`, `update_moc`, `read_hub`, `find_project_by_cwd`, `validate_frontmatter`,
  `scaffold_project`, `thread_meeting`, `check_dormant_features`, `list_projects`, `open_question`
- Shared libraries: vault-path resolution, YAML parsing, file operations
- Integration test (server start + tool listing)
- MCP tool preferences added to 5 skills (prefer MCP tools over manual file operations)
- Install scripts updated to v1.0.0

## v0.3.0-hooks — 2026-04-09

**Stage 3: deterministic lifecycle hooks.**

- 4 hooks: `session-start`, `post-tool-use`, `user-prompt-submit`, `stop`
- `session-start` loads vault context and caches trigger phrases before the model's first turn
- `post-tool-use` auto-logs vault file writes to `_changelog.txt`
- `user-prompt-submit` routes trigger phrases to the matching skill
- `stop` flushes pending memory updates on session end
- Polyglot hook wrapper (`run-hook.cmd`) for cross-platform support
- Automated test runner with 8 assertions

## v0.2.0-a-plus — 2026-04-08

**Stage 2: A+ skill rewrite.**

- Monolith skill split into 8 focused skills: `cortex-boot`, `cortex-check-status`,
  `cortex-update-context`, `cortex-process-meeting`, `cortex-ingest-project`,
  `cortex-register-repo`, `cortex-knowledge`, `cortex-onboarding`
- 7 slash commands: `cortex-capture`, `cortex-status`, `cortex-ingest`, `cortex-meeting`,
  `cortex-weekly`, `cortex-backfill`, `cortex-onboard`
- 4 cross-cutting reference guides (activation levels, capture rules, trigger phrases, vault conventions)
- 10 human-runnable test scenarios covering all skills
- Cowork install mechanism corrected (separate plugin store)

## v0.1.0-scaffold — 2026-04-08

**Stage 1: plugin scaffolding, no behavior changes.**

- Initial plugin repo
- Migrated existing Cortex skill into `skills/cortex/`
- Plugin manifest and local marketplace manifest
- Install scripts for Claude Code (CLI) and Claude Desktop

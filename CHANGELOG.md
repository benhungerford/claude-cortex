# Claude Cortex Plugin — Changelog

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

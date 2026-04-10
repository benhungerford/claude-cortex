# Claude Cortex Plugin — Changelog

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

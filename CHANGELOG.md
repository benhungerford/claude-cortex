# Claude Cortex Plugin — Changelog

## v0.1.0-scaffold — 2026-04-08

**Stage 1 of plugin migration: scaffolding only, no behavior changes.**

- Initial plugin repo created at `~/Documents/claude-cortex-plugin/`
- Migrated existing `~/.claude/skills/cortex/` content into `skills/cortex/` unchanged
- Plugin manifest (`.claude-plugin/plugin.json`)
- Local marketplace manifest (`.claude-plugin/marketplace.json`)
- MCP stub (`.mcp.json`, empty `mcpServers`)
- Install scripts for Claude Code (CLI) and Claude Desktop
- Original `~/.claude/skills/cortex/` backed up to `~/.claude/skills/cortex-pre-plugin-backup/`

No functional changes — Cortex behaves identically to the pre-plugin install. Stage 2 (A+ rewrite + skill split) is the next milestone.

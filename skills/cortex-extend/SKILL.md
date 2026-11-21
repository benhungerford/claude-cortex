---
name: cortex-extend
description: Creates custom Cortex companion skills and plugins. Fires when the user says "I want Cortex to...", "add a skill that...", "extend Cortex to...", "make Cortex do...", or "create a custom skill". Supplies the rules any skill-creation flow needs to build a Cortex-compatible extension.
---

# cortex-extend

The user describes what they want Cortex to do; this skill pins down the intent, adds the Cortex compatibility rules below, and hands off to a skill-creation flow. It doesn't write the skill itself.

## Steps

1. **Restate the request** in one sentence. Ask at most 2 questions, only about what's unclear: what triggers it (phrase, schedule, tool event), what it reads (vault files, MCP connectors), what it writes, and where.
2. **Hand off** to the best available skill creator: `skill-creator`, then `create-agent-skills` / `create-agent-skill`, then writing the files yourself. Pass the one-sentence request, the trigger/read/write/where answers, and the rules below.
3. **Check the result** against the rules, help the user install it, and confirm it will load next to Cortex.

If the request duplicates something Cortex already does, point to that skill instead. If the user wants to change Cortex itself, explain that core updates would overwrite their edits and offer a companion skill that adds to or overrides the behavior.

## Cortex extension rules

**Separate plugin.** Companion skills live in their own plugin (default `~/Documents/cortex-extensions/`, ask if the user prefers elsewhere), never inside the Cortex plugin, so Cortex updates don't wipe them.

**Use the Cortex MCP tools** (`mcp__plugin_claude-cortex_cortex-vault__<tool>`) rather than editing vault files by hand; they apply the vault's conventions. Main ones: `read_hub`, `list_projects`, `find_project_by_cwd`, `scaffold_project`, `open_question`, `thread_meeting`, `update_moc`, `append_changelog`, `validate_frontmatter`, `search_vault`, `recall_related`, `update_memory`, `generate_base`. The server lists the rest.

**Follow the vault's own rules.** Read the vault's `.claude/rules/` files (frontmatter and tags, changelog format, wikilinks, routing) and `personality.md` for folder names and vocabulary. Don't assume a folder layout. Two conventions that trip people up: YAML tags must be quoted strings (`"#source/x"`; unquoted `#` starts a comment and the tag becomes null), and every vault write gets an `append_changelog` entry.

**Route through Cortex.** Decisions, scope changes, and blockers go through `cortex-update-context`; meetings through `cortex-process-meeting`; reusable knowledge through `cortex-knowledge`. Ambiguous content goes to `_Inbox/`.

**Respect the activation level** shown in the session context block. At L1, ask before any vault write. At L3, writes from a repo session need an explicit request.

**Find the vault** through the MCP tools or `~/.claude/cortex/config.json` (`vault_path`). Never hardcode a path.

**Don't compete with core.** No second changelog logger, boot sequence, or capture system. Don't write `personality.md` or `memory.md` directly; use a file of your own, or `update_memory`. Don't add a hook that repeats a Cortex hook (Cortex's PostToolUse already logs vault writes; read `_changelog.txt` instead).

**End write skills with a check:** `validate_frontmatter` on each note written and a look at the folder's `_MOC.md` for the new entry.

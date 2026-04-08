# Claude Cortex

> Always-on vault intelligence for an Obsidian-based second brain.

Claude Cortex is a Claude Code / Claude Desktop plugin that turns Claude into a vault-aware agent. It reads its own memory, understands your projects, and actively maintains a structured Obsidian knowledge base as conversations happen — capturing decisions, blockers, meeting outcomes, and reusable patterns without being asked.

**Status:** v0.1.0-scaffold — Stage 1 of the plugin migration. Behavior is identical to the pre-plugin Cortex skill. The A+ rewrite, slash commands, hooks, and MCP server land in subsequent stages.

---

## What's in the box

```
claude-cortex-plugin/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest
│   └── marketplace.json     # local marketplace (single-plugin)
├── .mcp.json                # MCP server registrations (currently empty)
├── skills/
│   └── cortex/              # the always-on Cortex skill
│       ├── SKILL.md
│       ├── workflows/       # detailed playbooks
│       ├── references/      # convention guides
│       └── assets/          # templates
├── scripts/
│   ├── install-cli.sh       # install into Claude Code
│   └── install-desktop.sh   # install into Claude Desktop / Cowork
└── ...
```

---

## Install — Claude Code (CLI)

The plugin ships with a self-contained local marketplace. From a Claude Code session:

```text
/plugin marketplace add ~/Documents/claude-cortex-plugin
/plugin install claude-cortex@claude-cortex-local
```

Then restart your session. Cortex will load on every new conversation.

For development (load directly without installing):

```bash
claude --plugin-dir ~/Documents/claude-cortex-plugin
```

You can also use the helper script:

```bash
bash ~/Documents/claude-cortex-plugin/scripts/install-cli.sh
```

The script prints the two `/plugin` commands above and verifies the plugin manifest is valid before you run them.

---

## Install — Claude Desktop / Cowork

Claude Desktop loads skills from a different location and does not currently support Claude Code's hook system. The Desktop install script copies the `skills/cortex/` directory into the Desktop skills folder so the always-on skill works in Cowork sessions.

```bash
bash ~/Documents/claude-cortex-plugin/scripts/install-desktop.sh
```

Then restart Claude Desktop. The skill will load on every new Cowork conversation.

> **Note:** Until the `cortex-vault` MCP server (Stage 4) ships, Desktop and CLI installs have identical functionality. Once hooks land in Stage 3, CLI users will get auto-logging and deterministic trigger detection that Desktop users will get via skill-based fallbacks.

---

## Uninstall

**Claude Code:**
```text
/plugin uninstall claude-cortex@claude-cortex-local
/plugin marketplace remove claude-cortex-local
```

**Claude Desktop:** delete the copied `cortex` skill folder from your Desktop skills directory.

---

## Development

- Edit files in `~/Documents/claude-cortex-plugin/`
- For Claude Code: use `claude --plugin-dir ~/Documents/claude-cortex-plugin` to test changes without reinstalling
- For Claude Desktop: re-run `install-desktop.sh` after every change (it copies, not symlinks)

---

## Roadmap

- **v0.1.0** *(current)* — Plugin scaffolding, existing skill migrated, dual-runtime install
- **v0.2.0** — A+ skill rewrite, monolith split into 9 focused skills, slash commands, test scenarios
- **v0.3.0** — Hooks (PostToolUse changelog, SessionStart cache, UserPromptSubmit router, Stop flush)
- **v1.0.0** — `cortex-vault` MCP server enforcing vault conventions at the tool layer

See `Work/Personal/Ben Hungerford/Claude Cortex/Product Development/plans/2026-04-08-plugin-migration-and-a-plus-rewrite.md` in the vault for the full plan.

---

## License

MIT — see [LICENSE](./LICENSE).

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

## Install — Claude Desktop Code sidebar

The Code sidebar inside Claude Desktop uses the same `~/.claude/plugins/` store as the Claude Code CLI. If you've already installed via the Claude Code install above, the sidebar picks it up on restart — quit Desktop (Cmd+Q), reopen, start a new Code session.

---

## Install — Cowork (Claude Desktop agentic mode)

**Cowork uses a SEPARATE plugin store** from Claude Code and the Code sidebar. It does not inherit `~/.claude/plugins/`. The plugin has to be installed into Cowork's own store at:

```
~/Library/Application Support/Claude/local-agent-mode-sessions/<session-id>/<workspace-id>/cowork_plugins/
```

Use the desktop install script (it mirrors the install into every Cowork workspace it finds):

```bash
bash ~/Documents/claude-cortex-plugin/scripts/install-desktop.sh
```

Then:

1. Quit Claude Desktop completely (Cmd+Q)
2. Reopen Claude Desktop
3. Start a new Cowork session
4. `claude-cortex:cortex` should appear in the loaded skills

> **Caveats:**
> - If Cowork creates a new workspace after you install, you'll need to re-run `install-desktop.sh`.
> - **Remote Cowork** (running on Anthropic's infrastructure, not local agent mode) cannot see your local plugin folder. Requires a public marketplace — tracked as part of Stage 4.
> - **Regular Claude Desktop Chat** (not Cowork, not Code sidebar) is not yet supported. It uses the DXT extension format, which is a separate build target.

---

## Uninstall

**Claude Code:**
```text
/plugin uninstall claude-cortex@claude-cortex-local
/plugin marketplace remove claude-cortex-local
```

**Claude Desktop:** uninstall via the same `/plugin uninstall` flow inside a Claude Code session, then restart Desktop. (No separate Desktop uninstall — same install, same uninstall.)

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

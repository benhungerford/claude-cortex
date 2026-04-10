# Claude Cortex

> Always-on vault intelligence for an Obsidian-based second brain.

Claude Cortex is a Claude Code / Claude Desktop plugin that turns Claude into a vault-aware agent. It reads its own memory, understands your projects, and actively maintains a structured Obsidian knowledge base as conversations happen — capturing decisions, blockers, meeting outcomes, and reusable patterns without being asked.

**Status:** v1.0.0 — All 4 stages complete. 9 skills, 7 slash commands, 4 hooks, and a 10-tool MCP server.

---

## What's in the box

```
claude-cortex-plugin/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest (v1.0.0)
│   └── marketplace.json     # local marketplace
├── .mcp.json                # cortex-vault MCP server registration
├── skills/                  # 9 focused skills
│   ├── cortex-boot/         # always-on session bootstrap
│   ├── cortex-check-status/ # read-only project status
│   ├── cortex-update-context/ # write decisions, blockers, scope changes
│   ├── cortex-process-meeting/ # meeting transcript → threaded vault note
│   ├── cortex-ingest-project/  # scaffold new projects
│   ├── cortex-register-repo/   # link code repos to vault projects
│   ├── cortex-knowledge/       # extract reusable patterns to Knowledge Base
│   ├── cortex-onboarding/      # first-run setup
│   └── cortex-extend/         # create custom companion skills
├── commands/                # 7 slash commands (cortex-capture, cortex-status, etc.)
├── hooks/                   # 4 lifecycle hooks
│   ├── session-start        # vault context + trigger phrase cache
│   ├── post-tool-use        # auto-log vault writes to _changelog.txt
│   ├── user-prompt-submit   # route trigger phrases to skills
│   └── stop                 # flush pending memory on session end
├── mcp-servers/
│   └── cortex-vault/        # 10-tool MCP server enforcing vault conventions
├── workflows/               # detailed playbooks for skill internals
├── references/              # convention guides, trigger phrases, activation levels
├── scripts/
│   ├── install-cli.sh       # install into Claude Code
│   └── install-desktop.sh   # install into Claude Desktop / Cowork
└── tests/                   # hook test runner + behavioral scenarios
```

---

## Install

### Claude Desktop (Cowork and Code sidebar)

1. Open **Customize** (left sidebar)
2. Click **+** next to "Personal plugins"
3. Select **Add marketplace**
4. Enter `benhungerford/claude-cortex-plugin`
5. Click **Claude Cortex** to install it

Works for both Cowork and the Code sidebar. Updates are available in the Customize pane when new versions are pushed to GitHub.

### Claude Code (CLI and IDE extensions)

From any Claude Code session (terminal, VS Code, JetBrains):

```text
/plugin marketplace add benhungerford/claude-cortex-plugin
/plugin install claude-cortex@benhungerford-claude-cortex-plugin
```

Restart your session. Cortex will load on every new conversation.

### Uninstall

**Claude Desktop:** Remove from the Customize pane under Personal plugins.

**Claude Code:**
```text
/plugin uninstall claude-cortex@benhungerford-claude-cortex-plugin
/plugin marketplace remove benhungerford-claude-cortex-plugin
```

---

## Extending Cortex

Cortex is designed to be extended. To add custom skills — like a sprint planner, a standup generator, or a Slack integration — just describe what you want:

> "I want Cortex to pull my Slack threads and file them as meeting notes"

Cortex will walk you through the details and create a companion plugin that works alongside the core. Your extensions live in their own plugin, so Cortex updates never overwrite your customizations.

Custom skills get full access to Cortex's 10 MCP tools, vault conventions, and activation levels. See `skills/cortex-extend/SKILL.md` for the full extension guide.

---

## Development

Clone the repo and load it directly without installing:

```bash
git clone https://github.com/benhungerford/claude-cortex-plugin
claude --plugin-dir /path/to/claude-cortex-plugin
```

For Claude Desktop, use `scripts/install-desktop.sh` to mirror the plugin into the Cowork plugin store. Re-run after every change (it copies, not symlinks).

---

## Version history

- **v0.1.0** — Plugin scaffolding, existing skill migrated, dual-runtime install
- **v0.2.0** — A+ skill rewrite, monolith split into 8 focused skills, 7 slash commands, test scenarios
- **v0.3.0** — Hooks (PostToolUse changelog, SessionStart cache, UserPromptSubmit router, Stop flush)
- **v1.0.0** *(current)* — `cortex-vault` MCP server with 10 tools enforcing vault conventions

---

## License

MIT — see [LICENSE](./LICENSE).

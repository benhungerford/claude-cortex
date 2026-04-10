# Claude Cortex

> Always-on vault intelligence for an Obsidian-based second brain.

Claude Cortex is a Claude Code / Claude Desktop plugin that turns Claude into a vault-aware agent. It reads its own memory, understands your projects, and actively maintains a structured Obsidian knowledge base as conversations happen — capturing decisions, blockers, meeting outcomes, and reusable patterns without being asked.

**Status:** v1.0.0 — All 4 stages complete. 8 skills, 7 slash commands, 4 hooks, and a 10-tool MCP server.

---

## What's in the box

```
claude-cortex-plugin/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest (v1.0.0)
│   └── marketplace.json     # local marketplace
├── .mcp.json                # cortex-vault MCP server registration
├── skills/                  # 8 focused skills
│   ├── cortex-boot/         # always-on session bootstrap
│   ├── cortex-check-status/ # read-only project status
│   ├── cortex-update-context/ # write decisions, blockers, scope changes
│   ├── cortex-process-meeting/ # meeting transcript → threaded vault note
│   ├── cortex-ingest-project/  # scaffold new projects
│   ├── cortex-register-repo/   # link code repos to vault projects
│   ├── cortex-knowledge/       # extract reusable patterns to Knowledge Base
│   └── cortex-onboarding/      # first-run setup
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

## Install — Claude Code (CLI)

Clone the repo, then install from a Claude Code session:

```bash
git clone https://github.com/benhungerford/claude-cortex-plugin
cd claude-cortex-plugin
```

```text
/plugin marketplace add /path/to/claude-cortex-plugin
/plugin install claude-cortex@claude-cortex-local
```

Then restart your session. Cortex will load on every new conversation.

For development (load directly without installing):

```bash
claude --plugin-dir /path/to/claude-cortex-plugin
```

You can also use the helper script:

```bash
bash /path/to/claude-cortex-plugin/scripts/install-cli.sh
```

The script verifies the plugin manifest, installs MCP server dependencies (`npm install`), and prints the two `/plugin` commands to run.

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
bash /path/to/claude-cortex-plugin/scripts/install-desktop.sh
```

Then:

1. Quit Claude Desktop completely (Cmd+Q)
2. Reopen Claude Desktop
3. Start a new Cowork session
4. `claude-cortex:cortex-boot` should appear in the loaded skills

> **Caveats:**
> - If Cowork creates a new workspace after you install, you'll need to re-run `install-desktop.sh`.
> - **Remote Cowork** (running on Anthropic's infrastructure, not local agent mode) cannot see your local plugin folder. Requires a published marketplace (not yet available).
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

- For Claude Code: use `claude --plugin-dir /path/to/claude-cortex-plugin` to test changes without reinstalling
- For Claude Desktop: re-run `install-desktop.sh` after every change (it copies, not symlinks)

---

## Version history

- **v0.1.0** — Plugin scaffolding, existing skill migrated, dual-runtime install
- **v0.2.0** — A+ skill rewrite, monolith split into 8 focused skills, 7 slash commands, test scenarios
- **v0.3.0** — Hooks (PostToolUse changelog, SessionStart cache, UserPromptSubmit router, Stop flush)
- **v1.0.0** *(current)* — `cortex-vault` MCP server with 10 tools enforcing vault conventions

---

## License

MIT — see [LICENSE](./LICENSE).

# Claude Cortex

> Always-on vault intelligence for an Obsidian-based second brain.

Claude Cortex is a Claude Code / Claude Desktop plugin that turns Claude into a vault-aware agent. It reads its own memory, understands your projects, and actively maintains a structured Obsidian knowledge base as conversations happen — capturing decisions, blockers, meeting outcomes, and reusable patterns without being asked.

---

## What's in the box

```
claude-cortex/
├── .claude-plugin/
│   ├── plugin.json          # plugin manifest
│   └── marketplace.json     # local marketplace
├── .mcp.json                # cortex-vault MCP server registration
├── skills/                  # 11 focused skills
│   ├── cortex-boot/         # always-on session bootstrap
│   ├── cortex-check-status/ # read-only project status
│   ├── cortex-update-context/ # write decisions, blockers, scope changes
│   ├── cortex-process-meeting/ # meeting transcript → threaded vault note
│   ├── cortex-ingest-project/  # scaffold new projects
│   ├── cortex-register-repo/   # link code repos to vault projects
│   ├── cortex-knowledge/       # extract reusable patterns to Knowledge Base
│   ├── cortex-coach/           # adaptive skill development coaching
│   ├── cortex-onboarding/      # first-run setup
│   ├── cortex-extend/         # create custom companion skills
│   └── cortex-daily/          # generate copy-paste Claude Routine prompt for daily pipeline
├── commands/                # 8 slash commands (cortex-capture, cortex-status, cortex-index, etc.)
├── hooks/                   # 4 lifecycle hooks
│   ├── session-start        # vault context + trigger phrase cache
│   ├── post-tool-use        # auto-log vault writes + re-embed edited notes
│   ├── user-prompt-submit   # route trigger phrases to skills
│   └── stop                 # flush pending memory on session end
├── mcp-servers/
│   └── cortex-vault/        # 16-tool MCP server (conventions + semantic search)
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
4. Enter `benhungerford/claude-cortex`
5. Click **Claude Cortex** to install it

Works for both Cowork and the Code sidebar. Updates are available in the Customize pane when new versions are pushed to GitHub.

### Claude Code (CLI and IDE extensions)

From any Claude Code session (terminal, VS Code, JetBrains):

```text
/plugin marketplace add benhungerford/claude-cortex
/plugin install claude-cortex@benhungerford-claude-cortex
```

Restart your session. Cortex will load on every new conversation.

### Update

**Claude Desktop:** Updates appear automatically in the Customize pane when new versions are pushed to GitHub.

**Claude Code:**
```text
claude plugin update claude-cortex@benhungerford-claude-cortex
```
Restart your session after updating.

### Uninstall

**Claude Desktop:** Remove from the Customize pane under Personal plugins.

**Claude Code:**
```text
/plugin uninstall claude-cortex@benhungerford-claude-cortex
/plugin marketplace remove benhungerford-claude-cortex
```

---

## Getting Started

### Prerequisites

- **[Obsidian](https://obsidian.md)** — free, local-first note app. Cortex uses an Obsidian vault as its knowledge base. If you don't have it yet, the setup will walk you through installing it.
- **Claude Code or Claude Desktop** — with the Cortex plugin installed (see Install above).
- **MCP connectors** *(optional)* — Cortex can pull live data from Gmail, Google Calendar, Monday.com, Figma, Slack, and Google Drive if you connect them during setup.

### First run

When you start your first session with Cortex installed, it detects that no vault exists and walks you through setup automatically. No slash command needed — just start a conversation.

The setup takes about 15 minutes and covers:

1. **Obsidian setup** — pick or create a vault location
2. **5 discovery questions** — your role, how your work is organized, your weekly rhythm, what tools you use, and what falls through the cracks
3. **Tool connections** — optionally authenticate MCP connectors for tools you mentioned
4. **The build** — Cortex scaffolds your vault with a personalized folder structure, a `personality.md` that captures your answers, and a changelog that tracks everything going forward
5. **Developer setup** *(if applicable)* — register code repos so Cortex can detect which project you're working on by directory

By the end, you have a working vault and Cortex is aware of your world.

### How Cortex adapts

Cortex runs at three activation levels depending on context — you don't configure these, they happen automatically:

| Level | When it activates | What Cortex does |
| --- | --- | --- |
| **L1 — Passive** | You're outside the vault and no project is mentioned | Loads your context silently. Watches for decisions and blockers to capture. Stays out of the way. |
| **L2 — Vault-Aware** | You mention a project name or you're working inside the vault | Reads project status on demand. Surfaces blockers if something looks stale. |
| **L3 — Full Project** | Your working directory is a registered code repo | Opens with the project name, current stage, and open blockers. Full project awareness every turn. |

### What to do next

- **Ask about your work** — "what's the status of \<project\>?" or "what's blocking \<project\>?" to see vault awareness in action
- **Drop a meeting note** — paste a transcript or say "process this meeting" and Cortex will thread it into the right project folder
- **Capture a decision** — say "we decided to use Stripe for payments" mid-conversation and Cortex logs it to the project hub automatically
- **Register a code repo** — open Claude in a project directory and say "register this repo" to link it to a vault project for L3 sessions

---

## Extending Cortex

Cortex is designed to be extended. To add custom skills — like a sprint planner, a standup generator, or a Slack integration — just describe what you want:

> "I want Cortex to pull my Slack threads and file them as meeting notes"

Cortex will walk you through the details and create a companion plugin that works alongside the core. Your extensions live in their own plugin, so Cortex updates never overwrite your customizations.

Custom skills get full access to Cortex's 16 MCP tools, vault conventions, and activation levels. See `skills/cortex-extend/SKILL.md` for the full extension guide.

---

## Semantic search

As of v1.3.0, Cortex ships with local semantic search over your vault.

**What it does:** finds notes by meaning, not just keywords. A query for "checkout abandonment" will surface notes talking about "cart drop-off" — even if they share no words.

**How it works:** Cortex embeds each `.md` note into a 384-dimensional vector using the `all-MiniLM-L6-v2` model (runs locally in Node via `@huggingface/transformers`). Vectors live in a SQLite + `sqlite-vec` database at `{your vault}/.cortex/search.db`. No API key, no cloud, no vault data ever leaves your machine.

**Truly offline embedding.** The model is loaded only from a bundled local directory (`mcp-servers/cortex-vault/models/`) with remote model fetching disabled (`env.allowRemoteModels = false`), so embedding makes **no outbound network call** at runtime. The ~86 MB ONNX weight **is committed to git** and ships with the plugin, so semantic search works fully offline from first install — no setup download, no API key, no vault data ever leaves your machine.

**MCP dependencies install automatically.** `node_modules` is not shipped in a marketplace install, so on first launch the MCP server's bootstrap wrapper auto-installs its dependencies (announced on stderr, ~30–60s the first time). This pulls only public npm packages and sends **no vault data** anywhere — it does not affect the offline-embedding guarantee above. This makes the MCP tools reliable even in no-terminal surfaces like Cowork, where you can't run `npm install` by hand. Strict-offline users who never want an outbound call can set `CORTEX_SKIP_NPM_INSTALL=1`; the server then fails fast with manual install instructions instead of reaching the network.

**Two modes:**

| Mode | When it fires | MCP tool |
|---|---|---|
| **Explicit search** | You ask: "find everything about X" | `search_vault` |
| **Ambient recall** | Claude silently recalls related notes when you start a task, name a vendor, or hit a blocker | `recall_related` |

**First-time setup:** run `/cortex-index` once to build the index. Takes ~30–90 seconds depending on vault size. After that, the `post-tool-use` hook re-embeds notes automatically as you edit them.

**To rebuild from scratch:** delete `{vault}/.cortex/search.db` and run `/cortex-index`.

---

## Development

Clone the repo and load it directly without installing:

```bash
git clone https://github.com/benhungerford/claude-cortex
claude --plugin-dir /path/to/claude-cortex
```

For Claude Desktop, use `scripts/install-desktop.sh` to mirror the plugin into the Cowork plugin store. Re-run after every change (it copies, not symlinks).

---

## Version history

- **v0.1.0** — Plugin scaffolding, existing skill migrated, dual-runtime install
- **v0.2.0** — A+ skill rewrite, monolith split into 8 focused skills, 7 slash commands, test scenarios
- **v0.3.0** — Hooks (PostToolUse changelog, SessionStart cache, UserPromptSubmit router, Stop flush)
- **v1.0.0** — `cortex-vault` MCP server with 10 tools enforcing vault conventions
- **v1.1.0** — Boot pipeline rewrite, zero-read cortex-boot, no-permission L1, cortex-extend skill
- **v1.2.0** — `cortex-coach` adaptive skill development coaching, learner profiles, 3 coaching workflows, auto-update support
- **v1.3.0** — Semantic search + ambient recall: local embeddings, vector index at `{vault}/.cortex/search.db`, `search_vault` / `recall_related` / `reindex_vault` MCP tools, `/cortex-index` slash command, auto re-embed hook
- **v1.3.1** — Bootstrap wrapper verifies `node_modules` on launch and installs missing MCP dependencies, so the tools keep working across plugin cache refreshes and no-terminal installs. The install is announced (never silent) and sends no vault data; set `CORTEX_SKIP_NPM_INSTALL=1` to opt out.
- **v1.4.0** — Onboarding rewrite (adaptive tone register, 50+ compliance regimes, multi-axis schema, three build modes, accessibility); path-traversal guards on MCP tools; registry reconciliation with `register_repo` MCP tool; changelog write chokepoint. MCP tool count now 16.
- **v1.4.1** — Cowork / hookless-surface reliability: MCP deps auto-install on launch (opt out `CORTEX_SKIP_NPM_INSTALL=1`); `recall_related` / `search_vault` self-heal a stale index (opt out `CORTEX_NO_AUTO_REINDEX=1`); `cortex-boot` hookless-surface maintenance contract; README/doc-drift corrections.
- **v1.4.2** — `cortex-daily` skill: generates a copy-paste Claude Routine prompt for the unattended daily pipeline (connector pull → dedup → file → stepped briefing). Connector-agnostic, customizable sections (YouTube opt-in), chat + saved copy with diff refresh, L1 confirm-before-write; wired into the dormant `daily_briefing` activation.

---

## License

MIT — see [LICENSE](./LICENSE).

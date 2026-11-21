---
name: cortex-register-repo
description: The repo-to-vault bridge. Registers a code repo against a vault project and writes a Cortex stub CLAUDE.md into it, bulk-registers every repo under a parent folder, or resolves the current directory to a registered project. Fires on "register this repo", "link this folder", "scan for repos", "what project is this cwd", or when an orphaned Cortex stub is found.
---

# cortex-register-repo

Link code repos to vault projects so a Claude Code session opened inside a repo starts with that project's context. The session-start hook reads the registry and resolves the directory on its own; this skill writes the registry, the stubs, and handles the cases the hook can't.

| Operation | Triggers | Workflow |
|---|---|---|
| Register one repo | "register this repo", "link this folder", "this repo is for X", a handoff from `cortex-ingest-project` | `workflows/register-repo.md` |
| Backfill | "scan for repos", "backfill repos", "register all my repos" | `workflows/backfill-repos.md` |
| Resolve / orphan | "what project am I in", "what repo is this", a Cortex stub with no registry match | `workflows/resolve-cwd.md` |

## The three files

| File | Path | Role |
|---|---|---|
| Global config | `~/.claude/cortex/config.json` | Where the vault is |
| Registry | `<vault>/.claude/cortex/registry.json` | Repo paths mapped to projects; the source of truth |
| Repo stub | `<repo>/CLAUDE.md`, copied from `assets/repo-claude-stub.md` | Marks the repo as Cortex-managed; holds no vault content |

If the stub and registry disagree, the registry wins. Design notes: `references/bridge-architecture.md`.

## Tools

Cortex MCP tools are named `mcp__plugin_claude-cortex_cortex-vault__<tool>`. `register_repo` updates the registry and refuses a path another project already owns. `find_project_by_cwd` does the walk-up lookup. `list_projects` gives candidates for fuzzy matching. Log with `append_changelog`.

## Rules

- Matching is by filesystem path, not git, so plain folders (a WordPress install, a design asset folder) work. The longest matching ancestor wins; two entries matching the same path is a data problem worth a warning.
- Never replace an existing `CLAUDE.md` without asking. Show its first 20 lines and offer yes / no / show full diff.
- Backfill writes stubs into many repos, so every one needs the user's Y, n, or skip. Show at most 10 at a time.
- If a registered project's folder or hub is missing, say so plainly ("Registry entry for X points at Y, which doesn't exist. Was the vault restructured?") instead of quietly dropping to L1.
- A malformed `registry.json` gets reported, not overwritten. A missing one is created as `{"schema_version": 1, "projects": []}` and logged.
- If the user's cwd doesn't look like a repo (home folder, a cloud-sync root), confirm before writing a stub there.
- Registering to a project that doesn't exist yet: hand off to `cortex-ingest-project` first.
- This skill writes only the registry and stubs, never hubs or notes, and runs no git commands.

## Closing check

Before you report done:

1. Confirm `registry.json` parses and contains each `repo_path` you registered under the right project id, with `vault_path` and `context_file` pointing at a hub file that exists.
2. Confirm each stub you wrote exists and starts with `# Cortex-managed repo`.
3. Run `validate_frontmatter` on any vault note you touched (normally none).
4. Show the result in one short table: repo, project, registry entry, stub.

If a check fails, fix it and run the check again before confirming.

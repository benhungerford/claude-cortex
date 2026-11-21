# Repo bridge architecture

The bridge lets a Claude Code session in a code repo and a session in the vault see the same project context.

| File | Path | Role |
|---|---|---|
| Global config | `~/.claude/cortex/config.json` | Where the vault is. Changes only if the vault moves. |
| Registry | `<vault>/.claude/cortex/registry.json` | Repo paths mapped to projects. Kept in the vault so it's versioned with everything else, and it's the source of truth. |
| Repo stub | `<repo>/CLAUDE.md` | Marks the repo as Cortex-managed. Holds no vault content. |

Lookup: config → registry → the project's `<Project> — Project Context.md`. The session-start hook does this walk on every session start.

Why it's built this way:
- Repos know nothing about the vault, so restructuring the vault never touches a repo; only registry entries change.
- Walking up from the cwd works from any subfolder, the way git finds `.git`.
- A stale entry produces a visible prompt, not a silent null.

Workflows: `workflows/resolve-cwd.md`, `workflows/register-repo.md`, `workflows/backfill-repos.md`. Design spec: `docs/` in the plugin repo (repo bridge design, 2026-04-07).

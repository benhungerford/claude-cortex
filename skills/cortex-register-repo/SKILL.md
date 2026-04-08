---
name: cortex-register-repo
description: The repo-to-vault bridge. Three operations under one skill — (1) register a single code repo against a vault project and write a stub CLAUDE.md into it, (2) resolve the current working directory to a registered project by walking up the directory tree, (3) backfill-scan a parent folder to bulk-register every repo found. Fires on "register this repo", "link this folder", "scan for repos", "what project is this cwd", or when an orphaned Cortex stub is detected.
---

# cortex-register-repo

**STATUS: Stub.** Content being migrated from three monolith workflows. Do not invoke yet.

## Purpose

Make Cortex work from inside a code repo, not just from inside the vault. Registers the bridge once; after that, opening a Claude session in any registered repo auto-loads that project's context.

## Triggers

- "Register this repo", "link this folder to a project"
- "Scan for repos", "backfill repos", "find my project folders"
- cwd doesn't resolve but contains an orphaned `CLAUDE.md` Cortex stub
- Session start in a cwd outside the vault (runs the walk-up match silently)

## Absorbs

- `skills/cortex/workflows/register-repo.md`
- `skills/cortex/workflows/backfill-repos.md`
- `skills/cortex/workflows/resolve-cwd.md`

## References

- `references/bridge-architecture.md`
- `assets/repo-claude-stub.md`

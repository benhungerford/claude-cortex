# Cortex repo bridge — architecture reference

Cortex bridges two execution contexts (Claude Desktop in the vault, Claude Code CLI in a code repo) so both see the same project context.

## Three files, three jobs

| File | Lives at | Job |
|---|---|---|
| Global config | `~/.claude/cortex/config.json` | Tells Cortex where the vault is. Tiny. Updated only if vault moves. |
| Registry | `<vault>/.claude/cortex/registry.json` | Maps repo paths → vault projects. Lives in the vault so it's the source of truth and version-controlled with everything else. |
| Repo stub | `<repo>/CLAUDE.md` | Static stub. Says "invoke Cortex". Contains zero vault knowledge. |

## Lookup chain

```
~/.claude/cortex/config.json     ← "vault is HERE"
        │
        ▼
<vault>/.claude/cortex/registry.json     ← "repo X = project Y"
        │
        ▼
Work/.../Project Context.md     ← actual content
```

## Why this design

- Repos stay vault-agnostic. Vault restructures don't touch any repo file.
- Vault is the single source of truth. Repo stubs are not duplicates.
- Walk-up matching mirrors `git`/`package.json` resolution — works from any subdirectory.
- Failures are loud (missing entries trigger prompts), not silent (stale paths returning null).

## Related workflows

- `workflows/resolve-cwd.md` — walk-up matching
- `workflows/register-repo.md` — register one repo
- `workflows/backfill-repos.md` — register many at once

## Spec

Full design spec lives in the vault at:
`Work/Personal/Ben Hungerford/Cortex Onboarding/Product Development/specs/2026-04-07-cortex-repo-bridge-design.md`

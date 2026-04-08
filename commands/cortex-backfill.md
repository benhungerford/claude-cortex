---
description: Bulk-scans a parent folder for code repos and registers each one against a matching vault project, writing Cortex stub CLAUDE.md files into every repo found. Usage:/cortex-backfill <comma-separated scan roots>. If no argument is given, defaults to ~/Documents/Freelance Projects/.
---

# /cortex-backfill

Invoke the `cortex-register-repo` skill in backfill mode against the scan roots in `$ARGUMENTS`.

**Arguments:** `$ARGUMENTS` — optional comma-separated list of parent directories to scan for code repos. If empty, use the default scan root `~/Documents/Freelance Projects/`.

**Procedure:**
1. Load `cortex-register-repo`.
2. Parse `$ARGUMENTS` as a comma-separated list of paths. If empty, use `~/Documents/Freelance Projects/` as the single scan root.
3. Run the backfill workflow (`workflows/backfill-repos.md`) against each scan root: walk the tree, detect repos, fuzzy-match each to an existing vault project, and write a Cortex stub `CLAUDE.md` into every confirmed match.
4. Surface any repos that couldn't be matched so the user can resolve them manually.
5. Return a summary of repos registered, repos skipped, and unresolved matches.

**Failure modes:** delegate to `cortex-register-repo`'s failure modes — especially the ambiguous-match and orphaned-stub cases.

**Related:** `skills/cortex-register-repo/SKILL.md` · `workflows/backfill-repos.md`

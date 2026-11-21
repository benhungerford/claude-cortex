---
description: Bulk-scans a parent folder for code repos and registers each one against a matching vault project, writing Cortex stub CLAUDE.md files into every repo found. Usage:/cortex-backfill <comma-separated scan roots>. If no argument is given, defaults to ~/Documents/Freelance Projects/.
---

# /cortex-backfill

Invoke the `cortex-register-repo` skill in backfill mode against the scan roots in `$ARGUMENTS`.

**Arguments:** `$ARGUMENTS` — optional comma-separated list of parent directories to scan for code repos. If empty, use the default scan root `~/Documents/Freelance Projects/`.

**Procedure:**
1. Load `cortex-register-repo`.
2. Parse `$ARGUMENTS` as a comma-separated list of paths. If empty, use `~/Documents/Freelance Projects/` as the single scan root.
3. Run `workflows/backfill-repos.md` against each root: list subfolders one level deep, match them to vault projects, get the user's confirmation, and register each confirmed repo.
4. Run the skill's closing check, then summarize registered, skipped, and unmatched repos.

**Related:** `skills/cortex-register-repo/SKILL.md` · `workflows/backfill-repos.md`

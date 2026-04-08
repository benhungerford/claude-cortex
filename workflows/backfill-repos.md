# Backfill: scan for existing repos and register them

**When to use:** One-time, after the user upgrades to bridge-aware Cortex. Also runnable on demand if the user adds new repos in bulk.

## Procedure

**Step 1: Ask for scan roots**

Prompt:

> I can scan a folder for existing project repos and register them. Where should I look?
> Default: `~/Documents/Freelance Projects/`
> You can supply multiple paths separated by commas.

Wait for the user's response. If they accept the default, use it. Parse comma-separated paths and validate each one exists.

**Step 2: Walk each root one level deep**

For each scan root, list its immediate subdirectories. For each subdirectory, classify it:

- **Strong match:** Contains a `CLAUDE.md` file. This is almost certainly a project repo.
- **Possible match:** Folder name fuzzy-matches a vault project name (case-insensitive, ignore punctuation/spaces). Check vault project names by listing `Work/*/*/` and `Work/Personal/Ben Hungerford/*/*/` directories.
- **No match:** Skip silently from the confirmation list.

**Step 3: Build the confirmation list**

For each strong/possible match, propose a registration:

```
Found possible repos. Confirm matches:

  ~/Documents/Freelance Projects/Jumpstart SC      → Jumpstart SC / WordPress Website Build  [Y/n/skip]
  ~/Documents/Freelance Projects/FOND              → FOND / Ongoing Store Development        [Y/n/skip]
  ~/Documents/Freelance Projects/random-folder     → no clear match — type a project name or [skip]
  ...
```

Ask the user to confirm in one pass. Accept `Y` (default), `n`/`skip`, or a typed project name override.

**Step 4: For each confirmed match, run register-repo**

Call `workflows/register-repo.md` once per confirmation, passing the resolved `project_id`, `vault_path`, `context_file`, and `repo_path`.

**Step 5: Summary**

When done, summarize:

```
Backfill complete.
  Registered: 7 repos
  Skipped: 2
  Conflicts: 0
```

If any conflicts occurred (e.g. existing CLAUDE.md the user declined to replace), list them so the user can decide later.

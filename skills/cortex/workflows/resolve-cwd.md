# Resolve cwd to a vault project

**When to use:** Any time Cortex needs to figure out which vault project (if any) the current working directory belongs to. Called by session startup, by `register-repo.md`, and by drift detection.

## Procedure

**Step 1: Load config and registry**

1. Read `~/.claude/cortex/config.json`. If it does not exist, abort and tell the user Cortex needs onboarding.
2. Extract `vault_path`.
3. Read `<vault_path>/.claude/cortex/registry.json`. If it does not exist, treat as empty registry (`{"schema_version": 1, "projects": []}`).

**Step 2: Walk up from cwd**

Starting at the current working directory, walk toward `/`:

- For each candidate path, check whether any project in the registry has this path in its `repo_paths` list.
- If a match is found, return that project entry. **First match wins.**
- If no match is found at the current candidate, set candidate to its parent and repeat.
- Stop when you reach `/` or your home directory, whichever comes first.

**Step 3: If no match, check for an orphaned stub**

Walk up from cwd a second time, this time looking for any `CLAUDE.md` file. For each one found:

- Read the first 20 lines.
- If the content matches the Cortex stub (look for the phrases "Cortex-managed repo" or "invoke the Cortex skill"), this is an *orphaned* repo — registered before, but the path drifted.
- Return `{ "status": "orphaned", "stub_path": <path to CLAUDE.md> }`.

**Step 4: If still nothing, return unregistered**

Return `{ "status": "unregistered" }`. The caller should stay silent — not every cwd is a vault project.

## Caller behavior

- **Match found:** Load that project's context (see SKILL.md session startup, Level 3).
- **Orphaned:** Prompt the user once: *"This looks like a Cortex-managed repo, but I don't recognize this path. Is this **[closest project name match]**? Or pick from list / skip."* Use fuzzy matching against project `id` fields. On confirmation, update the project's `repo_paths` and proceed.
- **Unregistered:** Stay silent. Do not prompt.

## Edge cases

- **Cwd is inside the vault itself:** Skip this workflow entirely. Vault sessions use the existing Level 2 (Vault-Aware) flow.
- **Multiple registry entries match the same parent:** Should not happen — repo_paths must be unique. If it does, surface a warning and pick the first.
- **`vault_path` in config points at a nonexistent directory:** Surface immediately: *"Cortex config points at a vault that doesn't exist: <path>. Update `~/.claude/cortex/config.json`."*

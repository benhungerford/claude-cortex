# Register a repo against a vault project

**When to use:** When the user has a code repo that should be linked to a vault project, and either (a) you're setting up a new project, (b) the user explicitly asks to register a repo, or (c) you're processing the backfill flow.

## Inputs

- `project_id` — slug for the project (e.g. `jumpstart-sc-wordpress-build`)
- `vault_path` — relative path inside the vault (e.g. `Work/Personal/Jumpstart SC/WordPress Website Build`)
- `context_file` — filename of the project context file (e.g. `WordPress Website Build — Project Context.md`)
- `repo_path` — absolute path to the repo root

## Procedure

**Step 1: Validate the repo path**

- Confirm `repo_path` exists and is a directory. If not, surface the error and stop.
- Confirm `repo_path` is not already in another project's `repo_paths`. If it is, surface a conflict and ask the user how to resolve.

**Step 2: Update the registry**

Load `<vault>/.claude/cortex/registry.json`.

- If a project with `id == project_id` already exists, append `repo_path` to its `repo_paths` list (if not already present).
- Otherwise, add a new entry:

```json
{
  "id": "<project_id>",
  "vault_path": "<vault_path>",
  "context_file": "<context_file>",
  "repo_paths": ["<repo_path>"]
}
```

Write the registry back. Preserve formatting (2-space indent, trailing newline).

**Step 3: Write the stub CLAUDE.md**

Check whether `<repo_path>/CLAUDE.md` exists.

- **If not:** Copy the contents of `${CLAUDE_PLUGIN_ROOT}/assets/repo-claude-stub.md` to `<repo_path>/CLAUDE.md`. `${CLAUDE_PLUGIN_ROOT}` is the plugin install path exposed by Claude Code. Confirm to the user: *"Wrote Cortex stub to `<repo_path>/CLAUDE.md`."*
- **If yes:** Show the user the existing first 20 lines and ask: *"A `CLAUDE.md` already exists in this repo. Replace it with the Cortex stub? (yes / no / show full diff)"* On `yes`, replace it. On `no`, leave it alone but warn that Cortex won't auto-detect this repo on cwd resolution unless the existing CLAUDE.md mentions Cortex.

**Step 4: Log to vault changelog**

Append to `<vault>/_changelog.txt`:

```
[YYYY-MM-DD HH:MM] CREATED | FILE: registry.json | DEST: .claude/cortex/registry.json | NOTE: Registered repo <repo_path> against project <project_id>
```

If you also wrote a stub, add a second line:

```
[YYYY-MM-DD HH:MM] CREATED | FILE: CLAUDE.md | DEST: <repo_path>/CLAUDE.md | NOTE: Cortex repo stub
```

**Step 5: Confirm to user**

```
✓ Registered <project_id>
  Repo: <repo_path>
  Stub: <wrote new | kept existing | replaced existing>
```

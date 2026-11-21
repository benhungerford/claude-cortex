# Register a repo

Used when a new project links a repo, when the user asks to register one, and once per confirmed match in backfill.

Inputs: `project_id` (slug, e.g. `jumpstart-sc-wordpress-build`), `vault_path` (relative to the vault), `context_file` (the hub filename), `repo_path` (absolute). If the user asked directly, derive `repo_path` from the cwd when you can and fuzzy-match the project with `list_projects`; ask only for what's missing.

1. **Validate.** `repo_path` exists and is a directory, and no other project's `repo_paths` holds it. On a conflict, show the owning project and ask: move it, leave it, or cancel.
2. **Update the registry.** Call `register_repo`. Without the MCP server, edit `<vault>/.claude/cortex/registry.json` by hand: append to the matching project's `repo_paths`, or add `{id, vault_path, context_file, repo_paths: [repo_path]}`. Keep 2-space indent and a trailing newline.
3. **Write the stub.** If `<repo_path>/CLAUDE.md` doesn't exist, copy `${CLAUDE_PLUGIN_ROOT}/assets/repo-claude-stub.md` there. If it exists, show the first 20 lines and ask before replacing. If the user keeps their own file, tell them the orphan check only recognizes the Cortex stub, so registration in the registry is what matters.
4. **Log** to `<vault>/_changelog.txt`: one `UPDATED` line for `registry.json` (or `CREATED` if the file is new) noting the repo and project, and a `CREATED` line for the stub if you wrote one.
5. **Run the closing check,** then confirm:

```text
Registered <project_id>
  Repo: <repo_path>
  Stub: <wrote new | kept existing | replaced existing>
```

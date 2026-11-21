# Resolve the cwd

The session-start hook already resolves the cwd against the registry (`hooks/lib/boot-context.py`) and puts the result in the session context block as the level and project. Use this workflow when that block is missing (a surface without hooks), when the user asks "what project am I in", or to check for an orphaned stub.

1. **Look it up.** Call `find_project_by_cwd`, or `get_boot_context` on a hookless surface. By hand: read `vault_path` from `~/.claude/cortex/config.json` (missing means the user needs `cortex-onboarding`), read `<vault>/.claude/cortex/registry.json` (missing means empty), and walk up from the cwd to `/` or the home folder, checking each ancestor against every project's `repo_paths`. The longest match wins.
2. **No match: check for an orphan.** Walk up again looking for a `CLAUDE.md` whose first 20 lines contain "Cortex-managed repo" or "invoke the Cortex skill". That repo was registered once, but its path changed.
3. **Act on the result.**
   - Match: answer from the project's hub (stage, open blockers). This is read-only.
   - Orphan: ask once, "This looks like a Cortex-managed repo, but I don't recognize this path. Is this <closest project>? Or name a project, or skip." On a yes, add the path to that project's `repo_paths`, log it, and carry on at L3. On skip, don't ask again this session.
   - Nothing: say nothing. Most directories aren't projects.

If the cwd is inside the vault, skip this; that session is L2. If `vault_path` in the config points at a folder that doesn't exist, tell the user to fix `~/.claude/cortex/config.json`.

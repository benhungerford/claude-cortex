# Backfill repos

Bulk-register existing repos, usually once after installing Cortex or after adding several repos.

1. **Ask for scan roots.** Offer `~/Documents/Freelance Projects/` as the default and accept a comma-separated list. Check each path exists; if one doesn't, ask again rather than falling back.
2. **List each root one level deep** and sort the subfolders:
   - Strong: has a `CLAUDE.md`.
   - Possible: the folder name fuzzy-matches a project from `list_projects` (or from the bucket folders named in `personality.md`), ignoring case, punctuation, and spaces.
   - No match: leave out of the list unless the user wants to name a project for it.
3. **Confirm in one pass,** 10 at a time:

   ```text
   ~/Documents/Freelance Projects/jumpstart-wp  → Jumpstart SC / WordPress Website Build  [Y/n/skip]
   ~/Documents/Freelance Projects/sandbox       → no clear match — type a project name or skip
   ```

   Accept Y (default), n/skip, or a typed project name. If several projects match one folder, list them and let the user pick.
4. **Register** each confirmed folder with `workflows/register-repo.md`.
5. **Summarize:** registered, skipped, and conflicts (for example an existing `CLAUDE.md` the user kept), so the user can come back to the conflicts later.

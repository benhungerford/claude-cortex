# Update project context

Procedure for `cortex-update-context`. The routing table, conflict rule, and closing check live in that skill's SKILL.md; this file is the order of work.

Read `personality.md` at the vault root first. It gives `bucket_term` and the `sub_note_types` the project uses.

1. **Name the change.** Decision, new blocker, resolved blocker, scope change, status change, client preference, or new resource.
2. **Pick the file(s)** from the routing table. Hub: `<bucket_term>/<Project>/<Project> — Project Context.md`. Sub-notes sit beside it.
3. **Read only those files.**
4. **Check for a conflict.** If the new information contradicts the file, stop and ask, as the skill describes.
5. **Write.** Update the section, bump `updated:` on each modified file, and refresh the hub's "Last Updated" line if the hub changed. Add a Changelog.md row: `Date · What changed · Who decided · Notes`. For a new sub-note, add it to `_MOC.md` and the hub's Quick Links table.
6. **Resolved blocker:** remove the hub row and record the resolution in the Changelog.
7. **Log** each file operation to `_changelog.txt`.
8. **Run the closing check**, then announce in one line which files changed, e.g. `Updated FKT: cart moved to Rebuy in Tech Stack; logged to Changelog.`

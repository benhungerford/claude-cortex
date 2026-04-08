<required_reading>
**Read these reference files NOW:**
1. personality.md (in vault root — provides bucket_term, buckets, project_term, sub_note_types)
</required_reading>

<process>

**Step 1: Identify the Change**

Determine what needs updating:

- Blocker resolved or new blocker discovered
- Decision made (tech stack, scope, design direction)
- Scope change (addition or removal)
- Status change (page completed, stage progressed)
- New resource or link to log

**Step 2: Route to the Correct File**

Based on the type of change, determine which file(s) to update. Read `personality.md` to understand what sub-note types exist for this project.

| Change Type | Primary File | Also Update |
|-------------|-------------|-------------|
| Status, health, or stage change | Hub (`— Project Context.md`) | Changelog.md |
| New blocker or open question | Hub (`— Project Context.md`) | Changelog.md |
| Blocker resolved | Hub (`— Project Context.md`) — remove row | Changelog.md — log resolution |
| Technical decision | Relevant sub-note (per personality.md sub_note_types) | Changelog.md |
| Design decision | Relevant sub-note (per personality.md sub_note_types) | Changelog.md |
| Scope change | Hub (`— Project Context.md`) | Changelog.md |
| New resource or link | Relevant sub-note | — |
| New sub-note created | The new file | `_MOC.md`, Hub Quick Links table |

**All significant decisions get logged to `Changelog.md`** regardless of which file is the primary target.

**Step 3: Read Current Context**

Read the file(s) that will be modified:

- Hub: `<bucket_term>/<Name>/<Name> — Project Context.md`
- Sub-notes: `<bucket_term>/<Name>/<Sub-Note Name>.md`

Only read the files you intend to modify — not all sub-notes.

**Step 4: Check for Conflicts**

Before making changes, verify the update doesn't conflict with existing information. If it does:

`⚠️ CONFLICT DETECTED: [new info] contradicts [existing info]. How would you like to resolve this?`

Wait for the user to decide before proceeding.

**Step 5: Apply Changes**

- Update the relevant section(s) in the target file(s)
- Add a changelog entry to `Changelog.md`: `Date · What changed · Who decided · Notes`
- Update the "Last Updated" date at the top of the hub if the hub was modified
- Update the YAML frontmatter `updated` field to today's date on **every file that was modified**
- If a new sub-note is created:
  - Add it to `_MOC.md` under the appropriate section
  - Add a row to the Quick Links table in the hub

**Step 6: Blocker Cleanup**

When a blocker is resolved:

1. **REMOVE** the row from the hub's Open Questions & Blockers table entirely — do not use strikethrough
2. **ADD** a changelog entry to `Changelog.md` recording the resolution with date, what was resolved, and any relevant context
3. Re-number remaining rows in the Open Questions table if needed

This prevents accumulation of strikethrough noise in the hub.

**Step 7: Log to _changelog.txt**

Append to `_changelog.txt` in the vault root with a record of what was changed, in which files, and when.

**Step 8: Announce the Update**

```text
Project Updated — <Name>

What changed: [Brief summary]
Files modified: [List of files that were changed]
```

</process>

<success_criteria>
Update is complete when:

- [ ] Change identified and routed to the correct file(s) (hub vs sub-note)
- [ ] No unresolved conflicts
- [ ] Relevant section(s) updated in the correct file
- [ ] Changelog entry added to Changelog.md for all significant decisions
- [ ] YAML frontmatter `updated` field refreshed on every modified file
- [ ] "Last Updated" date refreshed on hub if hub was modified
- [ ] Resolved blockers removed from Open Questions table (not strikethrough)
- [ ] _MOC.md updated if a new sub-note was created
- [ ] Hub Quick Links table updated if a new sub-note was created
- [ ] Actions logged to _changelog.txt
- [ ] Update announcement provided
</success_criteria>
</output>

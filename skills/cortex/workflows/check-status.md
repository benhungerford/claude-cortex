<required_reading>
**Read these reference files NOW:**
1. personality.md (in vault root — provides bucket_term, buckets, project_term, sub_note_types)
</required_reading>

<process>

**Step 1: Identify the Project**

If multiple projects exist, determine which one the user is asking about:

- Check current working directory for CLAUDE.md project references
- If ambiguous, ask: "Which project?" and list available projects by reading the top-level MOC or scanning `<bucket_term>/` folders in the vault

**Step 2: Read the Hub File**

Read the project hub from `<bucket_term>/<Name>/<Name> — Project Context.md`.

This file contains the status overview, stage tracker, blockers, and quick links to sub-notes. It is the primary source for status checks.

**Step 3: Check Changelog for Recent Decisions**

Also read `<bucket_term>/<Name>/Changelog.md` to surface recent decisions and project history.

Do NOT read other sub-notes unless the user specifically asks about a topic covered by that sub-note.

**Step 4: Surface Relevant Information**

Present a focused status summary:

1. **Overall health** — Status indicator and one-line summary
2. **Current stage** — Where in the project lifecycle (from Project Stage Tracker)
3. **Active blockers** — Any open questions or blockers with open status
4. **Recent decisions** — Last 2-3 changelog entries from Changelog.md

**Step 5: Flag Actionable Items**

Proactively call out:

- Blockers that are on the critical path for current work
- Open questions that have been unresolved for a while
- Dependencies that need attention before the next phase
- Anything that contradicts what the user is currently working on

**Step 6: Offer to Dive Deeper** *(optional)*

If the status summary suggests the user might need more detail, offer to check relevant sub-notes. Reference the sub-note types from `personality.md` rather than assuming which sub-notes exist:

- "Want me to check any of the reference notes for this project?"
- "Need the full decision history from the Changelog?"

Only read sub-notes when the user confirms they want that detail.

</process>

<success_criteria>
Status check is complete when:

- [ ] Correct project hub file located and read
- [ ] Changelog.md checked for recent decisions
- [ ] Status summary presented with health, stage, blockers, recent decisions
- [ ] Actionable items flagged proactively
- [ ] User has a clear picture of where the project stands
- [ ] Sub-notes only read if user asks about a specific area
</success_criteria>
</output>

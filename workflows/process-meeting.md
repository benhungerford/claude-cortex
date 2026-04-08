<required_reading>
**Read these reference files NOW:**
1. personality.md (in vault root — provides bucket_term, buckets, project_term, sub_note_types, rhythms)
</required_reading>

<process>

**When to trigger:** The user shares meeting notes, a call transcript, a summary of a client conversation, or any record of a meeting that should be captured in the vault.

**Step 1: Identify the meeting context**

Determine:
- **Which project?** — Match to an active bucket using names, client references, or topic. Read `personality.md` for the list of known buckets.
- **Meeting type?** — Client call, QA review, internal sync, kickoff, user test, peer conversation
- **Is this project-related or general?** — Project meetings go to `<bucket_term>/<Name>/Notes/`. Non-project meetings (peer conversations, networking, tool discovery) go to `Meetings/`

If the project is unclear, ask: "Which project does this meeting relate to?"

**Step 2: Extract key information**

From the notes or transcript, extract:
- **Decisions made** — What was agreed on? What direction was chosen?
- **Action items** — Who needs to do what? By when?
- **Blockers discovered or resolved** — New issues or cleared obstacles
- **Scope changes** — Anything added, removed, or deferred
- **Client preferences** — Communication style, decision-making patterns, stated preferences
- **Technical details** — Stack choices, integration requirements, architecture decisions

**Step 3: Create the meeting note**

Create the file with the naming convention: `YYYY-MM-DD <Meeting Title>.md`

Add YAML frontmatter:

```yaml
---
created: YYYY-MM-DDTHH:mm
updated: YYYY-MM-DDTHH:mm
tags:
  - "#source/meeting"
  - "#type/meeting-notes"
  - "#status/active"
---
```

Structure the note with:
- H1 title matching the filename (without date prefix)
- **Date**, **Participants**, **Purpose** metadata
- **Context** section — what prompted the meeting
- Content sections organized by topic
- **Action Items** — checklist format
- Footer with `*Related:*` links

**Step 4: Thread with previous meetings**

Check the project's `Notes/` folder (or `Meetings/` for non-project meetings) for previous instances of the same meeting series:

1. Search for notes with similar titles (same meeting series, different dates)
2. Find the most recent prior instance
3. Add `*Previous:* [[YYYY-MM-DD Meeting Title]]` to the new note's footer
4. Edit the previous note to add `*Next:* [[YYYY-MM-DD Meeting Title]]`
5. Preserve any existing `*Related:*` links on both notes

If this is the first meeting in a series, skip threading — just ensure it's in the MOC.

**Step 5: Update project context**

Based on the extracted information, update the relevant files. Read `personality.md` to determine which sub-note types exist for the project:

- **Decisions** — Add to the project's `Changelog.md` under today's date
- **New blockers** — Add rows to the project hub's Open Questions table
- **Resolved blockers** — Remove from Open Questions (don't strikethrough), add resolution to Changelog
- **Scope changes** — Update relevant sections of the project hub
- **Client preferences** — Update the Client Info section of the project hub
- **Technical decisions** — Update the relevant sub-note (per personality.md sub_note_types)

**Step 6: Update MOC and log**

1. Add the meeting note to the project's `_MOC.md` under the Meeting Notes section
2. Log all file operations to `_changelog.txt`
3. Confirm with a summary: "Created meeting note, threaded with [previous meeting], updated [project] context with [N] decisions and [N] blocker changes."

</process>
</output>

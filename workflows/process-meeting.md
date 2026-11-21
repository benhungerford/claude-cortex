# Process a meeting

Procedure for `cortex-process-meeting`. Routing, threading, and the closing check are in that skill's SKILL.md.

Read `personality.md` at the vault root first for `bucket_term`, the known buckets, and `sub_note_types`.

1. **Place it.** Match the meeting to a project or client by name, client, or topic. Decide project `Notes/`, client `Meetings/`, or general meetings by the routing rule. For Granola/Fathom input, check the source ID for an existing note first.
2. **Extract** decisions, action items (who, what, by when), new and resolved blockers, scope changes, client preferences, and technical details.
3. **Create the note** as `YYYY-MM-DD <Title>.md`:

   ```yaml
   ---
   created: YYYY-MM-DDTHH:mm
   updated: YYYY-MM-DDTHH:mm
   source: granola            # or fathom, email, manual
   granola_id: <id>           # when there is one
   tags:
     - "#type/meeting-notes"
     - "#source/meeting"
   ---
   ```

   Body: H1 title (no date), the summary callout, Date / Participants / Purpose, Context, topic sections, `## Decisions`, `## Action Items` as a checklist, then the footer with `*Related:* [[_MOC]]` and the project hub.
4. **Thread** with `thread_meeting`, or by hand: find the latest note with the same title suffix, add `*Previous:*` to the new note and `*Next:*` to that one.
5. **Hand off** the decisions, blockers, scope changes, and preferences to `cortex-update-context` in one batch.
6. **MOC and log.** Add the note under Meeting Notes in the folder's `_MOC.md` and log each file operation to `_changelog.txt`.
7. **Run the closing check,** then announce in one line.

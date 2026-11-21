# Capture knowledge

Procedure for `cortex-knowledge`. The reusability test, article structures, and closing check are in that skill's SKILL.md.

Read `personality.md` at the vault root first for the user's domains and vocabulary.

1. **Name the knowledge type:** pattern, guide, vendor/tool note, or decision guide. Run the reusability test; project-specific content goes to `cortex-update-context`.
2. **Look for an existing article** in `Knowledge Base/_MOC.md` and by search. If `Knowledge Base/` doesn't exist yet, create it with a `_MOC.md` and log it.
3. **Write.**
   - New article: a descriptive title, a one-line description blockquote, and the sections for its type. Frontmatter:

     ```yaml
     ---
     created: YYYY-MM-DDTHH:mm
     updated: YYYY-MM-DDTHH:mm
     tags:
       - "#type/knowledge"
       - "#domain/<domain>"
       - "#status/evergreen"
     ---
     ```

     Add it to `Knowledge Base/_MOC.md` under the fitting section.
   - Existing article: add or update the section, keep everything else, bump `updated:`.
4. **Link** the article and the source project to each other.
5. **Log** to `_changelog.txt`: `CREATED` for a new article, `UPDATED` for an edit, `LINKED` for the project back-link.
6. **Run the closing check,** then confirm in one line.

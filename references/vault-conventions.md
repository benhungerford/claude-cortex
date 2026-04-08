<overview>

Quick reference for vault conventions. Read personality.md in the vault root for the user's vault path, bucket terms, and personal preferences before applying these conventions.

</overview>

<conventions>

**Tag Quoting — Critical**

All YAML tags must be quoted strings. The `#` character is a YAML comment delimiter.

```yaml
tags:
  - "#source/meeting"    # correct
  - #source/meeting      # WRONG — becomes null
```

Full reference: see `frontmatter-and-tags.md` in the vault's `.claude/rules/` directory.

**Tag Taxonomy**

| Prefix | Values |
|--------|--------|
| #domain/ | shopify, wordpress, frontend, backend, design, devops, seo |
| #source/ | meeting, client, internal, monday, figma, pastel, email |
| #status/ | active, evergreen, archived |
| #type/ | project-context, moc, meeting-notes, reference, spec, decision, qa-note, weekly-review, knowledge, changelog |

**Changelog Format**

Every vault operation must be logged to `_changelog.txt`:

```
[YYYY-MM-DD HH:MM] ACTION | FILE: [filename] | DEST: [destination path] | NOTE: [context]
```

Actions: MOVED, TAGGED, CREATED, PULLED, SKIPPED, UNKNOWN, MEMORY_UPDATED

Full reference: see `changelog-format.md` in the vault's `.claude/rules/` directory.

**Wikilinks**

- Use `[[wikilinks]]` for all internal links (Obsidian-native)
- Every note inside a bucket folder must include `*Project:* [[_MOC]]` in its footer
- Cross-link related notes bidirectionally
- When adding a note to a bucket folder, update that bucket's `_MOC.md`
- 3-7 links per note is right; more than 10 is too broad
- First occurrence only per note

Footer format:
```markdown
---
*Related:* [[_MOC]] · [[Tech Stack & Architecture]] · [[2026-03-20 Client Call]]
```

Full reference: see `wikilink-guidelines.md` in the vault's `.claude/rules/` directory.

**Meeting Threading**

Recurring meetings are linked chronologically with `*Previous:*` and `*Next:*` links. When adding a new meeting note to a recurring series, find the most recent prior instance and add bidirectional thread links.

Full reference: see `meeting-threading.md` in the vault's `.claude/rules/` directory.

**Routing Rules**

| Content Type | Destination |
|-------------|-------------|
| Meeting notes (client calls, QA reviews, syncs) | `[bucket_term]/<Name>/Notes/` |
| Project specs, decisions, trackers | `[bucket_term]/<Name>/` |
| Reusable knowledge (patterns, guides, vendor notes) | `Knowledge Base/` |
| Weekly reviews | `Weekly Reviews/` |
| Non-project meetings (peer convos, networking) | `Meetings/` |
| Unsorted or ambiguous | `_Inbox/` — leave and ask |

Read `personality.md` for the user's bucket_term to fill in the routing paths above.

Full reference: see `vault-structure.md` in the vault's `.claude/rules/` directory.

**Frontmatter Format**

Every note uses YAML frontmatter with at minimum: `created`, `updated`, `tags`. Project context hubs have additional fields: `type`, `project`, `client`, `status`, `health`.

Full reference: see `frontmatter-and-tags.md` in the vault's `.claude/rules/` directory.

</conventions>

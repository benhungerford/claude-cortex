# Vault conventions

The vault's own rule files in `<vault>/.claude/rules/` are the authority. When they exist, read the one you need instead of relying on this summary:

| Topic | Vault rule file |
|---|---|
| Frontmatter schemas, tag taxonomy | `frontmatter-and-tags.md` |
| `_changelog.txt` format and action types | `changelog-format.md` |
| Wikilinks, footers, MOC updates | `wikilink-guidelines.md` |
| Meeting series threading | `meeting-threading.md` |
| Where content goes | `routing-rules.md` |
| Folder layout, required project files | `vault-structure.md` |

Read `personality.md` for the user's `bucket_term`, buckets, domains, and vocabulary.

## Defaults for a vault without rule files

- **Tags are quoted strings:** `- "#source/meeting"`. Unquoted, the `#` starts a YAML comment and the tag becomes null.
- **Tag prefixes:** `#type/` (project-context, moc, meeting-notes, reference, knowledge, changelog, …), `#source/` (meeting, client, email, granola, …), `#status/` (active, evergreen, archived), and `#domain/` with whatever domains `personality.md` declares.
- **Every note** has `created` and `updated` in ISO format; bump `updated` on each edit. Project hubs also carry `type`, `project`, `client`, `status`.
- **Changelog line:** `[YYYY-MM-DD HH:MM] ACTION | FILE: <filename> | DEST: <relative path> | NOTE: <context>`. Actions: CREATED, MOVED, RENAMED, TAGGED, UPDATED, LINKED, PULLED, ARCHIVED, SKIPPED, UNKNOWN, MEMORY_UPDATED, MOC_UPDATED, STATUS_CHANGED. `append_changelog` checks the format.
- **Links:** `[[wikilinks]]` for internal links, both directions. Notes inside a bucket end with `*Related:* [[_MOC]] · …`. Adding a note to a folder means adding it to that folder's `_MOC.md`.
- **Routing:** project meetings go to `<bucket_term>/<Client>/<Project>/Notes/`; client-level meetings to the client's `Meetings/`; other meetings to `Meetings/`; reusable knowledge to `Knowledge Base/`; anything unclear stays in `_Inbox/` and gets raised with the user.
- **Obsidian syntax** (block IDs, callouts, embeds): `references/obsidian-syntax.md`.

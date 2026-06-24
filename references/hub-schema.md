# Hub Schema — Open Questions & Blockers

The project Context hub (`<Project> — Project Context.md`) stores open questions
and blockers in **one canonical representation**: a Markdown pipe-table under a
fixed heading. Every code path that reads or writes this data must use it.

## Canonical format

```markdown
## Open Questions & Blockers
| # | Question / Blocker | Type | Owner | Status |
|---|-------------------|------|-------|--------|
| 1 | Which payment provider? | Question   | Client | Open     |
| 2 | Stripe sandbox creds    | Dependency | Client | Open     |
| 3 | Database choice         | Internal   | Ben    | Resolved |
```

- **Heading** is exactly `## Open Questions & Blockers`.
- **Columns** are fixed: `# | Question / Blocker | Type | Owner | Status`.
- An empty hub carries a single placeholder row `| 1 | | | | Open |` (a row
  with an empty Question is ignored by readers).

## Classification rule (readers MUST match)

A row is a **blocker** when its `Type` is one of `Dependency`, `Internal`,
`Unknown`. Any other Type (e.g. `Question`, `External`) is an **open question**.

Rows with an empty `Question` **or** `Status == "Resolved"` (case-insensitive)
are skipped by readers (they are neither a live question nor a live blocker).

## Resolving (the Blocker-Resolved Rule)

Resolving a row **removes it from the table entirely**. Never strikethrough,
never leave a `Resolved` row behind via the tooling. The resolution is recorded
in the project `Changelog.md` and `_changelog.txt`. (Hand-authored `Resolved`
rows in Obsidian are tolerated by readers but the tooling does not create them.)

## The one implementation per language

| Language | Module / function | Role |
|---|---|---|
| JS | `mcp-servers/cortex-vault/lib/hub-schema.js` | `parseQuestionBlockerRows`, `classifyRows`, `addRow`, `resolveRow`, `emptyTable`, `migrateBodyToCanonical` |
| Python | `hooks/lib/boot-context.py` → `parse_hub` | reads the same table at boot |

`read_hub`, `open_question`, `list_projects`, and `scaffold_project` all route
through `hub-schema.js`. `parse_hub` mirrors the classification rule above.

**Cross-language guard:** `tests/run-hook-tests.sh` (Test 11) asserts that
`parse_hub` and `read_hub` extract identical blocker/question sets from the same
fixture hub. If you change the grammar, update both sides and that test.

## Migration

Legacy hubs used `## Open Questions` + `## Blockers` checkbox lists. Convert
them with:

```bash
node mcp-servers/cortex-vault/bin/migrate-hubs.js [vaultPath]          # dry-run
node mcp-servers/cortex-vault/bin/migrate-hubs.js [vaultPath] --apply  # write
```

Migration is idempotent: already-canonical hubs are left untouched.

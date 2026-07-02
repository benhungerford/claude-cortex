# Obsidian Syntax — Write-Path Reference

Distilled from Obsidian Flavored Markdown (kepano/obsidian-skills). Every Cortex
skill that writes a vault note follows these rules. Standard Markdown is assumed;
this covers only Obsidian extensions and where Cortex uses them.

## Wikilinks

```markdown
[[Note Name]]                    Link to note
[[Note Name|Display Text]]       Custom display text
[[Note Name#Heading]]            Link to a heading
[[Note Name#^block-id]]          Link to a specific block
```

Use `[[wikilinks]]` for all internal links (Obsidian tracks renames); use
`[text](url)` only for external URLs. See `vault-conventions.md` for link
density and footer rules.

## Block IDs

Append `^block-id` to any paragraph to make it linkable:

```markdown
Decided: inventory sync runs every 15 min. ^dec-2026-07-01-1
```

For lists, quotes, and tables, the block ID goes on its own line AFTER the block.

**Cortex rule — decisions get block IDs.** When writing a decision to a hub's
`## Key Decisions` section, append `^dec-YYYY-MM-DD-n` (n = 1-based counter for
that day). The matching Changelog entry links to it:
`[[<Project> — Project Context#^dec-2026-07-01-1]]`.

## Callouts

```markdown
> [!type] Optional title
> Body of the callout.
```

Types Cortex uses (others exist but keep to these):

| Type | Cortex use |
|---|---|
| `> [!summary]` | TL;DR block at the top of meeting notes |
| `> [!warning]` | Vendor quirks / gotchas in Knowledge Base articles |
| `> [!tip]` | Workarounds and recipes in Knowledge Base articles |
| `> [!question]` | Unresolved items inside meeting notes (NOT the hub table) |

Foldable: `> [!type]-` starts collapsed. Use collapsed for long meeting TL;DRs.

**NEVER** use callouts for the hub `## Open Questions & Blockers` table —
that table's pipe format is machine-parsed (see `hub-schema.md`).

## Embeds

```markdown
![[Note Name]]                   Embed entire note
![[Note Name#Heading]]           Embed one section
![[Note Name#^block-id]]         Embed one block
![[image.png]]                   Embed image
![[Client — Projects.base]]      Embed a Bases view
```

**Cortex rule — embed instead of copying.** When a hub or weekly review needs
a meeting's decisions, embed the section (`![[2026-07-01 Client Call#Decisions]]`)
rather than duplicating text that will go stale.

## Properties (frontmatter)

Frontmatter is YAML between `---` fences at the very top of the file.
Property types Obsidian understands: text, list, number, checkbox (true/false),
date (`YYYY-MM-DD`), datetime (`YYYY-MM-DDTHH:mm`).

Cortex-specific rules (see `vault-conventions.md` for the full schema):
- Tags are quoted strings: `- "#type/moc"` — `#` unquoted is a YAML comment.
- Dates are plain `YYYY-MM-DD` strings.
- Hub fields `type`, `project`, `client`, `status` drive `.base` dashboards —
  never rename them.

## Comments

`%%text%%` is visible in edit mode only. Cortex does not write comments to
vault notes (they hide content from readers and from search snippets).

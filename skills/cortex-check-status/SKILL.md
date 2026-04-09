---
name: cortex-check-status
description: Read-only project status lookups. Reads a project's Context hub and Changelog.md to answer questions like "what's the status of X", "where are we on Y", "what's blocking Z", "what's left on the project", "any open questions". Surfaces active blockers, recent decisions, and current stage in 2-5 sentences with file citations. Never writes to the vault.
---

# cortex-check-status

## Purpose

Answer status questions from the vault, not from guesses or session memory. Every answer cites the hub file or changelog it pulled from, so the user can verify.

The full playbook lives in `workflows/check-status.md`.

## When this skill fires

**Literal triggers:**
- "what's the status of <X>"
- "where are we on <X>"
- "what's left on <X>"
- "what's blocking <X>"
- "status of <X>"
- "any open questions on <X>"
- "is <X> on track"

`<X>` must fuzzy-match a known bucket or project in `personality.md` or in the vault's project folders.

See row 5 in `references/trigger-phrases.md`.

## MCP Tool Preferences

When the `cortex-vault` MCP server is available (tools prefixed with `mcp__cortex-vault__`), prefer these tools over manual file operations:

| Instead of... | Use MCP tool |
|---|---|
| Manually reading and parsing a project context hub | `mcp__cortex-vault__read_hub` |
| Manually enumerating all projects to find the right one | `mcp__cortex-vault__list_projects` |

If the MCP tools are not available (Desktop/Cowork without the server), fall back to the manual approach described in the steps below.

## Procedure

Run `workflows/check-status.md`. The workflow covers:

1. **Identify the project** — if ambiguous, list matching candidates and ask the user to pick
2. **Read the hub file** (`<bucket>/<Project>/<Project> — Project Context.md`)
3. **Read the Changelog.md** for recent decisions
4. **Surface a focused status summary**: health, stage, blockers, last 2-3 decisions
5. **Flag actionable items** proactively — things on the critical path, stale blockers, dependencies blocking next work
6. **Optionally offer to dive deeper** into a specific sub-note if relevant

## Critical rules

**Read-only. Never write.** Not to the hub. Not to the changelog. Not to `_changelog.txt`. If the user follows up with a write ("that blocker is actually resolved"), hand off to `cortex-update-context`.

**Cite every fact.** Each piece of information in the status summary must be traceable to a specific file. Format: end the summary with a line like `Sources: Project Context hub, Changelog (last 3 entries).`

**Only read the hub and changelog by default.** Sub-notes (Tech Stack, Design System, etc.) are not read unless the user asks a question specifically about their territory. This keeps the status check fast and scoped.

**Fuzzy-match project names generously.** "FKT", "Frankl and Thomas", "the FKT shopify build" all match the same project. Normalize case, ignore punctuation, match on substrings and common abbreviations.

**If ambiguous, ask once, then answer.** If "what's the status of Jumpstart" matches three projects, list them numbered, take the user's pick, then answer. Do not keep asking.

**Keep the summary tight.** 2-5 sentences. Not a report. The user wants to know what's happening; they can ask for more depth if they want it.

## Worked examples

### Example 1 — Unambiguous single project

```
User: "what's the status of FKT?"

Fuzzy match: single hit → Frankl & Thomas / Shopify Website Build.
Read:
  Work/TBL/Frankl & Thomas/Shopify Website Build/Shopify Website Build — Project Context.md
  Work/TBL/Frankl & Thomas/Shopify Website Build/Changelog.md (last 3 entries)

Response:
  "FKT Shopify Website Build — Integrations stage. 2 open blockers:
  Stripe sandbox credentials (waiting on client) and Sage integration
  (architecture decision pending). Recent: moved the checkout flow to
  Rebuy on 2026-04-03, resolved the product data migration on 2026-04-01.
  Sources: Project Context hub, Changelog (last 3 entries)."
```

### Example 2 — Ambiguous, two matches

```
User: "what's blocking Jumpstart?"

Fuzzy match: two hits:
  1. Jumpstart SC — WordPress Website Build
  2. Jumpstart Financial — Bookkeeping (hypothetical)

Response:
  "Two matches:
   1. Jumpstart SC (WordPress Website Build)
   2. Jumpstart Financial (Bookkeeping)
  Which one?"

User: "the WordPress one"
  → Answer the original question against Jumpstart SC.
```

### Example 3 — Project exists but has no blockers

```
User: "what's blocking FOND?"

Read hub. Open Questions table is empty.

Response:
  "FOND Ongoing Store Development — no open blockers. Last decision was
  the mega menu rollout on 2026-03-28. Current stage: Live / Ongoing Support.
  Sources: Project Context hub, Changelog."
```

### Example 4 — User asks a follow-up that implies a write

```
User: "what's the status of FKT?"
→ [status summary delivered]

User: "actually, that Stripe thing is resolved — we got the creds yesterday."

→ Do NOT silently update the hub. Hand off to cortex-update-context with
  the blocker-resolved intent. cortex-update-context will read the hub,
  remove the blocker row, log the resolution to Changelog, and confirm.
```

## Failure modes

| Failure | What to do |
|---|---|
| Project name doesn't match anything | One-line response: "I don't see a project called <name> in your vault. Did you mean <closest-match>? Or is this a new project you want me to scaffold?" Do not scaffold automatically — that's `cortex-ingest-project`'s decision. |
| Hub file is missing but the project folder exists | Surface the inconsistency: "<Project> folder exists but the Project Context hub is missing. Want me to scaffold the missing hub from the template?" Do not auto-create. |
| Hub file exists but has malformed YAML | Surface the parse error with the line number. Answer the user's question from the parseable portions if possible. |
| Changelog.md is missing | Answer from the hub alone. Note at the end: "Changelog.md not found — status is from the hub only." |
| The user asks a deep question that requires reading a sub-note (e.g. "what version of PHP is FKT on?") | Read the Tech Stack sub-note on demand. Do not cache it. Single-sub-note reads are allowed; scanning all sub-notes is not. |
| The user asks "what's the status" with no project name | Fall back: list their top 3 active projects by `updated` date and ask "which one?" |
| Project status field says "Archived" | Surface it: "<Project> is archived (moved on <date>). Do you want to see the last known status before it was archived?" |

## What this skill does NOT do

- Does not write. Anywhere. Ever.
- Does not scan every project. Only the one the user asked about.
- Does not read every sub-note. Only the hub and changelog by default.
- Does not interpret. If the hub says "2 open blockers", the response says "2 open blockers" — not "looks like you're in trouble". The user draws conclusions.

## Related

- **Workflow:** `workflows/check-status.md`
- **References:** `references/section-guide.md` (understanding what each hub section means)
- **Handoff target:** `cortex-update-context` (when a status query reveals a write intent)
- **Triggers:** row 5 in `references/trigger-phrases.md`

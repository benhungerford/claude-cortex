---
name: cortex-knowledge
description: Extracts reusable patterns, vendor quirks, debugging recipes, and how-to guides from conversation into Knowledge Base/. Fires when the conversation reveals knowledge that will apply beyond the current project, or when the user says "this is reusable", "worth remembering", "add to knowledge base", "file as a reference", or "save this pattern".
---

# cortex-knowledge

## Purpose

Separate project-specific context from reusable knowledge. Reusable stuff — a Cloudflare Workers pattern, a Beaver Builder + JSC quirk, an Obsidian Web Clipper workflow — goes to `Knowledge Base/` so it's findable from any future project. Project-specific stuff stays in the project.

The full playbook lives in `workflows/capture-knowledge.md`.

## When this skill fires

**Literal triggers:**
- "reusable", "worth remembering", "save this pattern"
- "add to knowledge base", "file as a reference"
- "for future projects", "next time this comes up"

**Ambient triggers** (soft — ask the user first):
- Conversation reveals a vendor quirk, library gotcha, or recipe that clearly applies beyond the current project. Cortex asks: `This sounds like a reusable pattern — want me to extract it to Knowledge Base?` (see rule below)

See rows 15–16 in `references/trigger-phrases.md`.

## Procedure

Run `workflows/capture-knowledge.md`. The workflow covers:

1. **Identify the knowledge type** — pattern, guide, vendor/tool note, or decision guide
2. **Apply the reusability test** (see below)
3. **Check for existing articles** in `Knowledge Base/`
4. **Create or update the article** with structured content
5. **Cross-link bidirectionally** — link to the source project, link back from the project
6. **Log and confirm** in one line

## The Reusability Test

Before writing anything to `Knowledge Base/`, answer this:

> **"Is this project-specific or would it help on a different project?"**

If the answer includes words like "only useful for FKT" or "specific to how the Apex database is set up" → project-specific. Write to the relevant project sub-note, not Knowledge Base. Hand off to `cortex-update-context`.

If the answer is "any future Shopify project", "any time I'm using Cloudflare Workers", "next time I touch an ACF field group" → reusable. Proceed.

**Err on the side of project-specific.** Knowledge Base articles that aren't actually reusable clutter the folder and hide the real reusables. If there's doubt, file to the project and let it get promoted later.

## Soft ambient trigger rule

The skill can fire *ambiently* when the conversation reveals a pattern that passes the reusability test, even if the user didn't say "reusable". But **always ask first** in this case:

> "That XML import trick for WordPress migrations sounds like it'd help on any future WP project. Want me to extract it to Knowledge Base?"

One ask, one response, then proceed or drop. Never ambiently extract without confirmation.

## Critical rules

**Search before creating.** Always check `Knowledge Base/_MOC.md` and search for related keywords before creating a new article. If a relevant article exists, update it rather than creating a duplicate.

**Structure appropriate to the knowledge type.** A pattern article has a "Problem / Solution / Example" structure. A vendor note has a "Quirk / Workaround / Context" structure. A guide has a step-by-step structure. Don't use one template for all of them.

**Cross-link bidirectionally.** The new article gets a `*Source:* [[<Project>]]` link. The source project's hub or changelog gets a `[[<KB Article>]]` link. Both directions. See `references/vault-conventions.md` (Wikilinks section).

**Practical, not theoretical.** Knowledge Base articles are for stuff the user will actually apply later. Avoid conceptual explanations, philosophical framings, or "best practices" essays. Every article should answer a concrete question the user might re-ask in 6 months.

## Worked examples

### Example 1 — Explicit trigger, new article

```
User: "worth remembering — when you clone a Shopify theme locally with the
       CLI, the schema.json validation is way stricter than Shopify Admin's
       UI. You need to explicitly declare every 'default' value even if it
       matches the type default, or `shopify theme dev` throws."

Reusability test: "any future Shopify theme build" → reusable. Proceed.

Step 2: Check Knowledge Base/_MOC.md. Scan for "Shopify CLI", "schema
  validation", "shopify theme dev". No existing article.

Step 3: Create
  Knowledge Base/Shopify CLI — schema.json validation stricter than Admin.md

  Article structure (vendor note type):
    ---
    Quirk:
      shopify theme dev validates schema.json more strictly than the
      Admin UI. Missing `default` values on fields cause the dev server
      to throw even when the Admin UI accepts the same setup.

    Workaround:
      Explicitly declare `default` on every setting, even if it matches
      the type default (e.g., empty string for text, 0 for number).

    Context:
      Discovered on 2026-04-08 during FKT Shopify Website Build while
      pulling the live theme for local dev.

Step 4: Bidirectional cross-link.
  Add *Source:* [[Shopify Website Build — Project Context]] to the new article.
  Add [[Shopify CLI — schema.json validation stricter than Admin]] to the
  FKT project's Changelog entry for today.

Step 5: Update Knowledge Base/_MOC.md.

Step 6: Announce:
  "Extracted 'Shopify CLI schema.json validation' to Knowledge Base.
   Cross-linked to FKT."
```

### Example 2 — Ambient trigger, user confirms

```
Conversation context: User is debugging a WordPress migration. They just
figured out that the `wp_options` autoload field was set to `yes` on 200+
rows and was the root cause of a 40-second page load.

Cortex (ambiently):
  "That `wp_options` autoload fix sounds like it'd apply to any large
   WP migration. Want me to extract it to Knowledge Base?"

User: "yeah, good call"

Proceed with Steps 1-6 as above. Article type: guide (step-by-step fix).
```

### Example 3 — User says "reusable" but it's actually project-specific

```
User: "worth remembering — we decided to run the FKT inventory sync every
       15 min instead of 5 min because their Sage instance times out
       otherwise"

Reusability test: The decision is specific to how FKT's Sage instance
  behaves. It's not a reusable pattern — it's a project-specific constraint.

Response:
  "That sounds specific to how FKT's Sage instance is configured rather
   than a reusable pattern. Want me to log it to FKT's Tech Stack instead?"

User: "yeah do that"

→ Hand off to cortex-update-context with the decision routed to the
  FKT Tech Stack sub-note.
```

### Example 4 — Article already exists

```
User: "save this — Obsidian Web Clipper lets you save web pages directly
       to your vault with frontmatter"

Step 2: Check Knowledge Base/. There's already an article called
  "Obsidian Web Clipper — saving web content with frontmatter.md".

Step 3: Update mode. Read the existing article. Check if the user's note
  adds anything new.

  User said "lets you save web pages directly to your vault with
  frontmatter" — that's the title of the existing article. No new info.

Response:
  "That's already in Knowledge Base — 'Obsidian Web Clipper'. Nothing
   new to add. Want me to open it?"

Do not create a duplicate. Do not bump the article's `updated:` field
for no-op input.
```

## Failure modes

| Failure | What to do |
|---|---|
| Reusability test is ambiguous — the knowledge *might* apply elsewhere but isn't clearly reusable | Ask the user: "Is this something you'd apply to other projects, or is it specific to <current-project>?" Route based on the answer. |
| User says "reusable" but the content is actually a personal preference or workflow habit, not a technical pattern | File it under a `Workflows/` subfolder of Knowledge Base (or the equivalent per the user's vocabulary). Don't force it into a "pattern" format. |
| Multiple candidate articles could absorb the new content | Surface: "This could go into <Article A> or <Article B>. Or create a new one. Which?" |
| Knowledge Base doesn't exist yet (fresh vault) | Create it with a `_MOC.md`. Log as `CREATED`. Then proceed. |
| User's knowledge is a verbal anecdote that needs structure | Ask one clarifying question to get a concrete example or step-by-step, then write. Do not file vague anecdotes. |
| The knowledge contradicts an existing Knowledge Base article | Flag the conflict (same as `cortex-update-context`'s Conflict Rule). Don't silently supersede. |
| The user uses "reusable" loosely and has 10 things to extract in one conversation | Batch them. Ask once: "You mentioned several reusable patterns today — want me to extract them all, or just <specific one>?" |

## What this skill does NOT do

- Does not write to project hubs or Changelogs. Only to `Knowledge Base/`.
- Does not maintain tags or domain classification for the user — it applies `#domain/<relevant>` based on the knowledge content, but the user can re-tag later.
- Does not extract knowledge without explicit or confirmed user intent. Ambient detection always asks first.
- Does not migrate existing project content into Knowledge Base. That's a one-off task, not this skill.

## Related

- **Workflow:** `workflows/capture-knowledge.md`
- **References:** `references/vault-conventions.md` (wikilinks, frontmatter for `#type/knowledge`)
- **Handoff target:** `cortex-update-context` (for project-specific content that failed the reusability test)
- **Callers:** `cortex-boot` (via capture-rules Tier 1 — "reusable pattern extracted from work")
- **Triggers:** rows 15–16 in `references/trigger-phrases.md`

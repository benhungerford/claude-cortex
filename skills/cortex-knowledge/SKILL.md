---
name: cortex-knowledge
description: Extracts reusable patterns, vendor quirks, debugging recipes, and how-to guides from conversation into Knowledge Base/. Fires when the conversation turns up knowledge that applies beyond the current project, or when the user says "this is reusable", "worth remembering", "add to knowledge base", "file as a reference", or "save this pattern".
---

# cortex-knowledge

Keep reusable knowledge (a Cloudflare Workers pattern, a Beaver Builder quirk, a migration recipe) in `Knowledge Base/`, where any later project can find it. Project-specific facts stay in the project. The step-by-step procedure is in `workflows/capture-knowledge.md`.

## When it fires

- Phrases: "worth remembering", "add to knowledge base", "file as a reference", "save this pattern", "for future projects", "this is reusable", "reusable pattern".
- Ambient: the conversation turns up a vendor quirk, library gotcha, or recipe that clearly applies elsewhere. Ask first, once: "That autoload fix sounds like it'd help on any big WP migration. Want me to add it to Knowledge Base?" Then proceed or drop it. Don't extract ambiently without a yes.

## Tools

Cortex MCP tools are named `mcp__plugin_claude-cortex_cortex-vault__<tool>`. Use `search_vault` to look for an existing article, `update_moc`, `append_changelog`, and `validate_frontmatter`.

## Rules

**Reusability test.** Ask: would this help on a different project? "Any future Shopify theme" or "any time I touch ACF field groups" passes. "Only because FKT's Sage instance times out" fails; offer to log it to that project instead and hand off to `cortex-update-context`. When in doubt, file it with the project; it can be promoted later. A Knowledge Base full of non-reusable notes hides the real ones.

**Search before creating.** Check `Knowledge Base/_MOC.md` and search for the topic. If an article covers it, update that article. If the input adds nothing new, say so and leave the article and its `updated:` date alone. If several articles could take it, ask which. If it contradicts an article, flag both versions and let the user decide.

**Structure by type.**
- Pattern: Problem / Solution / Example.
- Vendor or tool note: Quirk / Workaround / Context. The quirk goes in a `> [!warning]` callout, the workaround in `> [!tip]`.
- Guide: numbered steps.
- Decision guide: options and when to pick each.

Write for the question the user will re-ask in six months: concrete, with the actual commands or settings. Skip essays.

**Link both ways.** The article gets `*Source:* [[<Project> — Project Context]]`; the source project's Changelog entry or hub links back to the article. Link rules: the vault's `.claude/rules/wikilink-guidelines.md`.

**Web sources.** For a URL, fetch it with `defuddle parse <url> --md` and work from the clean markdown. URLs ending in `.md` go straight to WebFetch. If `defuddle` isn't installed, use WebFetch and, at most once a session, suggest `npm install -g defuddle`.

**Several items at once.** If the user flags many reusable things in one conversation, ask once whether to extract all of them or just one.

## Closing check

Before you report done:

1. Run `validate_frontmatter` on the article and on the project note you linked from.
2. Confirm `Knowledge Base/_MOC.md` lists the article as `[[<exact filename without .md>]]`, and that the back-link from the project resolves to the article's filename.
3. Show the result in one short table: file, frontmatter valid, MOC entry.

If a check fails, fix it and run the check again. Then confirm in one line: `Extracted "<topic>" to Knowledge Base; linked from <Project>.`

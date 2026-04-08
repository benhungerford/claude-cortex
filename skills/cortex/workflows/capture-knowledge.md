<required_reading>
**Read these reference files NOW:**
1. personality.md (in vault root — provides identity, mental_model, tools context)
</required_reading>

<process>

**When to trigger:** A conversation reveals a reusable pattern, solution, vendor insight, or process that would benefit future projects. This could be a technical approach, a tool discovery, a workflow optimization, or a lesson learned.

**Step 1: Identify the knowledge**

Determine what the reusable knowledge is:
- **Pattern** — A technical approach that works across projects (e.g., "Cloudflare Workers as Shopify Backend")
- **Guide** — A step-by-step process worth documenting (e.g., "WordPress Blog Migration — XML Import and SQL Cleanup")
- **Vendor/Tool Note** — A tool discovery or vendor-specific insight (e.g., "Obsidian Web Clipper")
- **Decision Guide** — A framework for choosing between options (e.g., "Frontend Library Decision Guide")

Ask yourself: "Is this project-specific or would it help on a different project?" If project-specific, it belongs in the project's sub-notes, not Knowledge Base.

**Step 2: Check for existing articles**

Search `Knowledge Base/` for existing articles on this topic:
- Read `Knowledge Base/_MOC.md` to see what already exists
- Search for related keywords in the Knowledge Base folder

If an existing article covers this topic, update it rather than creating a new one.

**Step 3: Create or update the article**

**If creating a new article:**

1. Create the file in `Knowledge Base/` with a descriptive title
2. Add YAML frontmatter:

```yaml
---
created: YYYY-MM-DDTHH:mm
updated: YYYY-MM-DDTHH:mm
tags:
  - "#type/knowledge"
  - "#domain/<relevant-domain>"
  - "#status/evergreen"
---
```

3. Write the article with:
   - A clear H1 title
   - A one-line description blockquote
   - Structured sections appropriate to the knowledge type
   - Practical, actionable content — not theoretical

4. Add to `Knowledge Base/_MOC.md` under the appropriate section

**If updating an existing article:**

1. Read the existing article
2. Add or update the relevant section
3. Update the `updated` field in frontmatter
4. Preserve all existing content

**Step 4: Cross-link**

- If the knowledge originated from a specific project, add a `*Related:*` link to the relevant project note
- If the project note references this topic, add a link back to the KB article
- Follow the wikilink guidelines: bidirectional links, footer format

**Step 5: Log and confirm**

- Log to `_changelog.txt` as CREATED (new article) or TAGGED (updated article)
- Confirm briefly: "Extracted [topic] to Knowledge Base."

</process>
</output>

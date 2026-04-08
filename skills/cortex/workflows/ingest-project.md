<required_reading>
**Read these reference files NOW:**
1. personality.md (in vault root — provides bucket_term, buckets, sub_note_types, project_term, identity)
2. references/section-guide.md
</required_reading>

<process>

**Step 1: Parse & Extract**

Read the raw input (brief, transcript, email, brain dump) and extract:

- **Goals** — What does the client want to achieve?
- **Requirements** — Specific features, pages, functionality
- **Technical constraints** — Hosting, CMS, existing systems, budget, timeline
- **Integrations** — APIs, plugins, third-party tools, external platforms
- **Design decisions** — Confirmed visual direction, Figma links, brand references
- **Open questions** — Anything ambiguous, unconfirmed, or needing a decision
- **Resources** — Links, file paths, repo locations, credentials references

**Step 2: Ask Clarifying Questions**

Before writing the doc, ask up to 3 targeted questions focused on **scope** and **dependency readiness**. Examples:

- "Is the contact form in scope for launch, or post-launch?"
- "Do you have access to the domain registrar yet, or is that still with the client?"
- "Is the Figma file fully approved or still in review?"

**Step 3: Choose a Project Emoji** *(new projects only)*

Before creating the context doc, ask the user to pick an emoji for the project. Present 3 suggestions based on the project type/industry (e.g., a law firm might get "⚖️", "🏛️", "📜") and offer an option for the user to provide their own:

```
Pick an emoji for this project:
1. [emoji] — [reason]
2. [emoji] — [reason]
3. [emoji] — [reason]
4. Or type your own

This will be used in the doc heading and vault metadata.
```

Wait for the user's response before proceeding.

**Step 4: Generate / Update the Context Doc**

Read `personality.md` from the vault root. Use the following values:
- `mental_model.bucket_term` — the top-level folder name (e.g., "Clients", "Projects")
- `mental_model.buckets` — existing named buckets and their sub-categories
- `mental_model.project_term` — what the user calls individual work items
- `mental_model.buckets[].sub_notes` — which sub-note types to create for each bucket

- **New project — Full Scaffolding:**

  When creating a new project, build the entire project folder structure:

  1. **Create the project folder:** `<bucket_term>/<Name>/`
     - If the user's personality defines sub-categories within their bucket_term, place the project in the appropriate sub-category folder.

  2. **Create `_MOC.md`** for the project:

     ```markdown
     ---
     type: moc
     tags:
       - "#type/moc"
     updated: YYYY-MM-DD
     ---

     # <Name>

     > [One-line project description]

     ## Project Hub
     - [[<Name> — Project Context]]

     ## Reference
     [Generate links for each sub-note type from personality.md's sub_note_types]

     ## Changelog
     - [[Changelog]]

     ## Meeting Notes
     *No meeting notes yet.*
     ```

  3. **Create `<Name> — Project Context.md`** hub from `assets/blank-template.md`. Populate all sections with extracted information. Include YAML frontmatter with: `type: project-context`, `project`, `client`, `status`, `health`, `tags` (including `#type/project-context`), `created` (today's date), `updated` (today's date).

  4. **Create initial sub-notes with YAML frontmatter:**

     Read the `sub_note_types` from `personality.md` for the relevant bucket. Create each sub-note with:
     - Frontmatter: `type: sub-note`, `parent: "<Name> — Project Context"`, `tags: ["#type/sub-note"]`, `updated: YYYY-MM-DD`.
     - Populate with any relevant extracted information. Leave sections empty (with placeholder structure) if no information is available yet.

     Additionally, always create:
     - **`Changelog.md`** — Decision log and project history. Include a table with columns: `Date | Change / Decision | Made By | Notes`.

  5. **Create `Notes/` subfolder** for meeting notes.

  6. **Add the project to the top-level MOC** (`<bucket_term>/_MOC.md` or the user's main dashboard) with the project name, status, and link.

  7. **Update `memory.md`** with the new project profile (if memory.md exists in the vault root).

  8. **Log all actions to `_changelog.txt`** in the vault root — record what files were created and when.

- **Existing project:** Read the current context file (the hub). Update only the relevant sections. Never overwrite unchanged sections. If the change involves technical details, update the appropriate sub-note instead of (or in addition to) the hub.

Use `references/section-guide.md` for guidance on what belongs in each section.

**Step 4.5: Link a code repo (optional, new projects only)**

Once the project folder and context file are created, ask the user:

> Does this project have a code repo I should link? (yes / no / later)

- **yes** → Ask: *"What's the absolute path to the repo root?"* Then call `workflows/register-repo.md` with the project's id (slugified project name), `vault_path` (relative path inside vault), `context_file` (the Project Context filename), and the supplied `repo_path`.
- **no** → Note in the project context's "Resources" section: `Repo: none`.
- **later** → Note in the project context: `Repo: not yet linked — register with workflows/register-repo.md when ready`.

**Step 5: Announce the Update**

After every create or update, output:

```text
Project Scaffolded — <Name>

Files created:
  - <bucket_term>/<Name>/_MOC.md
  - <bucket_term>/<Name>/<Name> — Project Context.md (hub)
  - <bucket_term>/<Name>/[sub-note for each type from personality.md]
  - <bucket_term>/<Name>/Changelog.md
  - <bucket_term>/<Name>/Notes/ (folder)

What changed: [Brief summary of what was populated from the raw input]

The hub file is the central source of truth. Sub-notes contain detailed
reference material linked from the hub's Quick Links table.
```

For updates to existing projects, use the simpler format:

```text
Project Updated — <Name>

What changed: [Brief summary of what was added or modified]
Files modified: [List of files that were changed]
```

</process>

<success_criteria>
Ingestion is complete when:

- [ ] All extractable information captured from raw input
- [ ] Clarifying questions asked (max 3) and answers incorporated
- [ ] Full project scaffolding created (new) or context file updated (existing)
- [ ] Sub-notes created based on personality.md's sub_note_types
- [ ] _MOC.md created linking hub and sub-notes
- [ ] Top-level MOC / dashboard updated
- [ ] Actions logged to _changelog.txt
- [ ] Update announcement provided with summary of changes
- [ ] No unresolved conflicts between new and existing information
</success_criteria>
</output>

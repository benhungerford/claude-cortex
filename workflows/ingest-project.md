# Ingest a project

Procedure for `cortex-ingest-project`. Rules and the closing check are in that skill's SKILL.md.

Read first: `personality.md` (vault root) for `bucket_term`, `buckets`, `project_term`, and each bucket's `sub_notes`; `references/section-guide.md` for what belongs in each hub section.

## 1. Extract

From the input, pull goals, requirements, technical constraints (hosting, CMS, budget, timeline), integrations, confirmed design direction (Figma links, brand refs), open questions, and resources (links, repo paths).

## 2. Ask

Up to 3 questions on scope and dependency readiness, e.g. "Is the Figma file approved or still in review?"

## 3. Emoji (new projects only)

Offer three emoji that fit the project, each with a short reason, plus "or type your own". Wait for the choice; it goes in the hub heading and frontmatter.

## 4. Scaffold

With the MCP server, call `scaffold_project` (pass `category` and `bucket_root` from the user's buckets; `domain` if one applies), then fill the files it created. Without it, create:

1. `<bucket_term>/<Client>/<Project>/` (inside the right sub-category if the user's buckets have them). Create the client folder first if it's new: `_MOC.md`, `<Client> — Client Context.md`, `Meetings/`.
2. `_MOC.md` with sections Project Hub, Reference (one link per sub-note), Changelog, Meeting Notes.
3. `<Project> — Project Context.md` from `assets/blank-template.md`, filled from step 1. Frontmatter: `type: project-context`, `project`, `client`, `status: Planning`, quoted tags including `"#type/project-context"`, `created`, `updated`.
4. One file per sub-note type, with frontmatter `parent: "<Project> — Project Context"` and placeholder sections where there's no information yet.
5. `Changelog.md` with a `Date | Change / Decision | Made By | Notes` table.
6. `Notes/`.
7. A row for the project in the parent MOC.
8. The project profile in `memory.md`, if the vault has one.
9. One `CREATED` line in `_changelog.txt` per file.

For an existing project, update only the sections the new input changes.

## 5. Repo (new projects only)

Ask: "Does this project have a code repo I should link? (yes / no / later)"

- yes: get the absolute repo path and hand off to `cortex-register-repo` with the project id (slug), `vault_path`, `context_file`, and `repo_path`.
- no: add `Repo: none` to the hub's Resources.
- later: add `Repo: not yet linked`.

## 6. Check and announce

Run the closing check, then:

```text
Project Scaffolded — <emoji> <Project>
Files created: <list>
Open Questions: <count and short list>
```

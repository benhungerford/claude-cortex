---
name: cortex-ingest-project
description: Scaffolds a new project inside an existing vault from raw input (a brief, transcript, email, SOW, brain dump, or just a project name). Creates the full project folder structure — _MOC, the Project Context hub, sub-notes based on personality.md's sub_note_types, a Changelog.md, and a Notes/ subfolder — and updates the parent bucket MOC. Fires when the user says "new project", "start tracking X", "scaffold a project for Y", or pastes a project brief.
---

# cortex-ingest-project

## Purpose

Get a brand-new project from zero to a fully-scaffolded vault entry in one pass. Reads the user's `personality.md` to use their vocabulary (bucket_term, sub_note_types) instead of hardcoded folder names.

The full playbook lives in `workflows/ingest-project.md`.

## When this skill fires

**Literal triggers:**
- "new project", "I'm starting a new <project_term>" (where project_term comes from personality.md)
- "start tracking <X>"
- "scaffold a project for <X>"
- "set up a project for <X>"
- "add <X> as a project"

**Structural triggers:**
- User pastes a long block of text (5+ lines, prose format) that mentions goals, deliverables, deadlines, or stakeholders, AND no existing project fuzzy-matches what's being described.
- User shares a contract, SOW, or kickoff email for work that doesn't match an existing bucket.

See row 10–11 in `references/trigger-phrases.md`.

## Preconditions

- `personality.md` exists at the vault root. If not → hand off to `cortex-onboarding`.
- The user's target client (or the equivalent of "client" in their vocabulary) either exists in the vault or the user is prepared to create it alongside the project.

## MCP Tool Preferences

When the `cortex-vault` MCP server is available (tools prefixed with `mcp__cortex-vault__`), prefer these tools over manual file operations:

| Instead of... | Use MCP tool |
|---|---|
| Manually creating the 6-element project folder structure | `mcp__cortex-vault__scaffold_project` |
| Manually formatting and appending entries to _changelog.txt | `mcp__cortex-vault__append_changelog` |
| Manually adding the new project to parent MOC files | `mcp__cortex-vault__update_moc` |

If the MCP tools are not available (Desktop/Cowork without the server), fall back to the manual approach described in the steps below.

## Procedure

Run `workflows/ingest-project.md`. The workflow covers:

1. **Parse & extract** — pull goals, requirements, technical constraints, integrations, design decisions, open questions, and resources from the raw input
2. **Ask up to 3 clarifying questions** — focused on scope and dependency readiness only (not preferences, not aesthetics)
3. **Pick an emoji** — offer 3 suggestions based on project type, or let the user type their own
4. **Generate the scaffolding** — create the 6-element project folder (`_MOC.md`, `<Name> — Project Context.md` hub, sub-notes per personality.md, `Changelog.md`, `Notes/` folder, and a row in the parent bucket MOC)
5. **Optionally link a repo** — ask if there's a code repo to register; if yes, hand off to `cortex-register-repo`
6. **Announce the update** with the exact file list

## Critical rules

**Use the user's vocabulary, not defaults.** Read `personality.md` → `mental_model.bucket_term` to determine the top-level folder name. Read `mental_model.buckets[].sub_notes` to determine which sub-notes to create for the target bucket. Never hardcode "Shopify Website Build" sub-note types if the user's personality says otherwise.

**Limit clarifying questions to 3.** More than 3 feels like an interrogation. If you need more, scaffold what you have, flag the unknowns as Open Questions in the hub, and let the user fill them in over time.

**Every sub-note gets created, even if empty.** If the user's bucket calls for a Design System sub-note but the input has no design info, create a stub with placeholder structure and an empty Figma field. Don't skip the file — future sessions will populate it.

**Log every file to `_changelog.txt`.** Each `CREATED` operation is a separate line. One scaffold can produce 6+ log entries.

**Never overwrite an existing project.** If the user's target project name already exists in the target bucket, switch to update mode — read the existing hub, apply the new information as an update, and route to `cortex-update-context` for the writes. Announce: `Project already exists — updating instead of scaffolding.`

## Worked examples

### Example 1 — Full brief pasted

```
User pastes a 40-line email from a client about a new WordPress site build:
goals, requirements, brand refs, timeline, preferred stack.

Step 1: Parse. Extract:
  goals=["migrate existing WP site to new hosting", "redesign homepage"]
  integrations=["WooCommerce", "Mailchimp"]
  design_refs=["Figma: <link>"]
  timeline="launch in 6 weeks"

Step 2: Ask 3 clarifying questions:
  "Is the WooCommerce migration including product data, or just the plugin
   setup?"
  "Do you have access to the current hosting account yet?"
  "Is the Figma file approved, or still in review?"

Step 3: Offer 3 emojis — 🛒, 🪴, 🏗️. User picks 🛒.

Step 4: Read personality.md. bucket_term="Clients". Target bucket is
  "Personal/Jane's Garden Shop" — does not exist. Create it.
  Sub-notes for this bucket: Tech Stack & Architecture, Design System.
  Create:
    Clients/Personal/Jane's Garden Shop/_MOC.md
    Clients/Personal/Jane's Garden Shop/Jane's Garden Shop — Client Context.md
    Clients/Personal/Jane's Garden Shop/Meetings/_MOC.md
    Clients/Personal/Jane's Garden Shop/WordPress Rebuild/_MOC.md
    Clients/Personal/Jane's Garden Shop/WordPress Rebuild/WordPress Rebuild — Project Context.md
    Clients/Personal/Jane's Garden Shop/WordPress Rebuild/Tech Stack & Architecture.md
    Clients/Personal/Jane's Garden Shop/WordPress Rebuild/Design System.md
    Clients/Personal/Jane's Garden Shop/WordPress Rebuild/Changelog.md
    Clients/Personal/Jane's Garden Shop/WordPress Rebuild/Notes/_MOC.md

Step 5: Ask "Does this project have a code repo to link?" User says "later".
  Note in hub Resources section.

Step 6: Announce:
  "Project Scaffolded — 🛒 WordPress Rebuild
  Client created: Jane's Garden Shop (new client in Personal)
  Files: 9 created (listed above)
  Open Questions: 3 (from the clarifying questions — WooCommerce scope,
  hosting access, Figma approval)"
```

### Example 2 — Just a name

```
User: "new project — let's call it FOND homepage refresh"

Step 1-2: No brief to parse. Ask 3 questions directly:
  "Which client? Is this under FOND or somewhere else?"
  "What's the scope — full homepage rebuild or targeted updates?"
  "Any deadline I should know about?"

After answers: FOND exists as a client, scope="hero + nav + footer refresh",
no deadline.

Step 3: Emoji offered — 🏡, ✨, 🎨. User picks ✨.

Step 4: Create the project folder inside the existing FOND client:
  Work/Personal/FOND/Homepage Refresh/...
  (full 6-element scaffold)

Step 5-6: Announce. 3 Open Questions listed in the hub for future fill-in.
```

### Example 3 — Name collides with existing project

```
User: "new project called FKT checkout"

Step 4: Read Work/TBL/Frankl & Thomas/. "FKT Checkout" does not exist, but
  "Shopify Website Build" does. This is NOT a collision — it's a new scoped
  project alongside an existing one. Scaffold normally.

Alternative: User says "new project FKT shopify build".
  "Shopify Website Build" already exists under Frankl & Thomas.
  Switch to update mode. Announce:
    "Project already exists — FKT / Shopify Website Build. Switching to
    update mode. What's new?"
  Hand off to cortex-update-context with the input.
```

## Failure modes

| Failure | What to do |
|---|---|
| `personality.md` missing | Hand off to `cortex-onboarding`. Cannot proceed without knowing the user's vocabulary. |
| User's target bucket doesn't exist and the user hasn't specified a client | Ask one question: "Which client is this under?" If they say "none / personal", create under the `<Personal>` equivalent from their bucket hierarchy. |
| Raw input is too vague to extract 3 clarifying questions from | Fall back to asking "Tell me more about <project>: scope, timeline, any dependencies or stakeholders I should know about?" Wait for a richer answer before scaffolding. |
| User's `sub_note_types` list is empty for the target bucket | Create only the 3 mandatory files (`_MOC.md`, `— Project Context.md`, `Changelog.md`) and the `Notes/` folder. Do not invent sub-notes. |
| File write fails (permission, disk) | Surface the error. Roll back any partial writes that already succeeded. Log the rollback to `_changelog.txt`. Do not leave a half-scaffolded project folder behind. |
| User names the project with characters that aren't filesystem-safe | Slugify the folder name, but preserve the original name inside the hub's `project:` YAML field and as the H1 title. |
| Target client already exists but the user seems to think it doesn't | Surface it: "I see a client called <X> already. Is this the same one, or a different client with a similar name?" |
| User's request contains 2+ projects mashed together | Ask: "I can scaffold both — do you want them as separate projects or one project with phases?" |

## What this skill does NOT do

- Does not capture decisions or blockers from ongoing project work. That's `cortex-update-context`.
- Does not process meeting notes about the project. That's `cortex-process-meeting` (which can itself handoff to ingest-project if the meeting is a kickoff for work not yet scaffolded).
- Does not pull data from connected tools to pre-populate the project. The user must supply the input. (Future: a separate `cortex-pull-project` skill could pull from Gmail/Monday/etc, but that's out of scope for Stage 2.)
- Does not register code repos inline. It asks and hands off to `cortex-register-repo` if the user says yes.

## Related

- **Workflow:** `workflows/ingest-project.md` — full extraction + scaffolding playbook
- **References:** `references/section-guide.md` (what belongs in each project hub section), `references/vault-conventions.md`, `references/capture-rules.md`
- **Assets:** `assets/blank-template.md` — the project context hub template
- **Handoff targets:** `cortex-register-repo` (optional, if a repo is linked), `cortex-update-context` (on name collision)
- **Triggers:** rows 10–11 in `references/trigger-phrases.md`

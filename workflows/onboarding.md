# Onboarding

First-run setup: introduction, platform and Obsidian, five discovery questions, tool connections, the vault build, developer setup, and a demo. It has to work for anyone, from a freelance developer to a clinician, a priest, or a twelve-year-old with a parent beside them, so most of the detail lives in reference files you read when the situation calls for it:

- `references/onboarding/adapting.md`: tone, accessibility, platform, install, sync, closing lines.
- `references/onboarding/compliance.md`: regulated data, minors, audit mode, privacy.md variants.
- `references/onboarding/discovery.md`: vocabulary menus, archetypes, sub-notes by industry, tools, pain-to-feature map, idioms to avoid.
- `references/onboarding/personality-schema.md`: every value to capture and the personality.md format.

## How to run it

- One question at a time. Don't re-ask anything the user already told you.
- Use the user's words on disk: "Mandanten", not "Clients"; "Punch List.md", not "Tasks.md". Keep diacritics and non-Latin scripts.
- Explain terms like vault, connector, or frontmatter in the same breath you use them. File bodies the user reads use their words, not Cortex field names (YAML frontmatter is fine).
- Track every value in `personality-schema.md` as you go. If one is missing at Step 5, ask; don't invent it.
- If a step fails, note it in `personality.md` and keep going. The only stop is failing to write `~/.claude/cortex/config.json`.
- If the user stops partway, save what you have with `setup_status: incomplete` so the next session resumes.
- When someone else set this up for them ("my son Marcus installed it"), note it for the close.

## Step 1: Introduction

> "This is Cortex — a short setup that turns Claude and Obsidian into a memory layer for your work. Five questions, then I build the folder structure, then we test it. About 10 minutes. OK?"

Set the tone register from the reply (`adapting.md`). Then say where data lives:

> "Your vault is a folder of plain text on this machine. Nothing leaves it until you connect a cloud tool, and you'll approve each one."

If the user mentions anything regulated, confidential, or involving minors, read `compliance.md` now and add:

> "I'll set this up for regulated data, so I won't connect any cloud tool by default. We'll go tool by tool later and you decide each one."

## Step 2: Platform, Obsidian, vault

1. **Check the platform** against the table in `adapting.md`. A phone or tablet alone can't host the vault.
2. **Ask about other devices:** "Mostly this computer, or a phone or iPad too?" Note the sync option for the close.
3. **Check for cloud sync** on the default path, and on a work machine ask about install blocks and endpoint monitoring (`compliance.md`, Corporate machines).
4. **Install Obsidian** per platform, with the Gatekeeper or SmartScreen warning up front. Before it opens, say: "Obsidian will offer to create or open a vault. Don't click anything yet. I'll make the folder first, then tell you which one to open, so we don't end up with two vaults."
5. **Look for an existing vault** (a `.obsidian/` folder in `~/Documents/`, `~/Obsidian/`, `~/notes/`, `~/vault/`, or a path the user named). If there is one, offer:
   1. Sandbox: a `Cortex/` subfolder inside it; nothing else touched. Default when unsure.
   2. Fresh: a separate vault.
   3. Metadata only: personality and rules at the existing vault's root, no new folders. Ask before overwriting an existing `personality.md`, `memory.md`, or `_changelog.txt`.
6. **Pick the path and name.** Default `~/Documents/<name>`, or outside sync for regulated users. If the folder already has files, ask: alongside, a different name, or cancel.
7. **Point Obsidian at the folder** once it exists: "Click 'Open folder as vault' and choose `<vault_path>`." Without Obsidian, any editor works.
8. **Note accessibility needs** from anything the user has said (`adapting.md`).

## Step 3: Discovery

**Q1, "What do you do?"** "Tell me about yourself: your role, where you work, what your days look like." Capture name, role, company, industry, `self_description` verbatim, `is_developer` (self-reference only), age if given, whether they work with minors, pronouns if volunteered. Check `compliance.md` for regulated, audit, and soft constraints. If the user is a minor, pause and ask about a parent or guardian before going on. Play back what you heard in their register; regulated users hear their constraints named.

**Q2, "What's the shape of your work?"** Offer 5-7 terms from the vocabulary menu (`discovery.md`). Then ask:
- "Within each <bucket_term>, are there several separate pieces of work, or is each one a single thing?" (nesting and `child_term`, per bucket)
- "Anything that runs across all your <bucket_term>, like vendors, contractors, funders, or sources?" (all of them go in `secondary_axes`)
- "Anything that's its own big thing, like a dissertation or a book?" (`parallel_threads`)

Decide the archetype from the answers (`discovery.md`).

**Q3, "What does a week look like?"** Walk through the busiest bucket: meetings, deliverables, collaborators. Suggest sub-notes from the industry table and let the user rename them.

**Q4, "What tools do you live in?"** Check each against the live connector registry (fallback table in `discovery.md`). For regulated users, minors, and audit mode, don't pitch connectors; ask which, if any, they want. Per-bucket NDA exposure sets connectors off for that bucket only.

**Q5, "What keeps getting lost?"** Ask literally: "What's the thing you keep losing track of? Decisions? Action items? Deadlines? Money owed? Something else?" Map it to a feature (`discovery.md`); with several, the most pressing is primary.

## Step 4: Connect tools

Connect at most 2 tools now; offer the rest for later ("say 'connect <tool>' any time"), because a long connector session drags setup out. Give the commands for the user's surface (`adapting.md`) and wait for them to confirm each. A failed sign-in goes under `available_not_connected` with the reason; carry on. A tool that touches regulated data gets `pull_mode: metadata_only`. If they connect nothing: "Nothing to connect today. The vault grows as you use it."

## Step 5: Build

1. **Write `~/.claude/cortex/config.json`:** `{"vault_path": "<vault_path>", "schema_version": 1}`, forward slashes on Windows. If this fails, show the error and the fix (`mkdir -p ~/.claude/cortex && chmod u+w ~/.claude/cortex`) and stop.
2. **Core files** in the vault (or the sandbox folder): `personality.md` (format in `personality-schema.md`), `memory.md` with who the user is, `_changelog.txt` with the setup entries (append-only in audit mode). For fresh and sandbox builds also `_Inbox/` and `Knowledge Base/`, each with a `_MOC.md`.
3. **Folders** by archetype (`discovery.md`). Every secondary axis and parallel thread gets its own top-level folder. Restricted sub-notes get a `_README.md` stating the tier.
4. **Bucket hubs** (fresh or sandbox, portfolio or hybrid): per bucket, `_MOC.md`, `<Bucket> — Context.md` (in the user's language: Kontext, Contexte), the Q3 sub-notes, `Changelog.md`, `Notes/`. Flag NDA buckets in their frontmatter. A queue gets one `Active.md` and a template instead.
5. **Pull the last 24 hours** from each connected tool, metadata only where `pull_mode` says so, skipping anything matching `exclude_on_ingest`. Say what was pulled and what was skipped.
6. **Vault `CLAUDE.md`:** a short file naming the user, their role, the vault layout in their terms, the archetype, and any constraints, pointing at `personality.md` and `.claude/rules/`.
7. **Rules in `.claude/rules/`:** `vault-structure.md` describing the actual layout, terms, and routing (marked advisory in a sandbox build); `audit-trail.md` in audit mode; an access-tier rule if there are restricted sub-notes; `privacy.md` when `compliance.md` calls for it.

Metadata-only builds run 1, 2 (core files only), 6, and 7.

## Step 6: Developer setup

Only when `is_developer` is true. Minors register repos only with a parent's OK.

1. Install for the other surface: on macOS run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/install-desktop.sh`; on Linux, Claude Desktop doesn't exist, so skip; on Windows, skip with a one-line note unless a Windows installer ships.
2. For each repo, get the absolute path and project and hand off to `cortex-register-repo`. Windows users on GitHub Desktop can right-click a repo and choose Show in Explorer for the path. Skip NDA-restricted repos.

## Step 7: Demo and close

If a connector pulled real content: "Try me — ask anything about your work." Otherwise: "Tell me one thing — a decision today, a deadline coming up — and I'll file it in the right <bucket> so you can see it appear." Regulated users: "Use a code or initials, not a name." Developers with repos: mention that opening Claude Code in that repo now loads the project.

Close with the lines from `adapting.md` that apply, in plain words. No sales talk.

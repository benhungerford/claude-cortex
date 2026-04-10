---
name: cortex-extend
description: Creates custom Cortex companion skills and plugins. Fires when the user says "I want Cortex to...", "add a skill that...", "extend Cortex to...", "make Cortex do...", or "create a custom skill". Teaches any skill-creation flow how to build Cortex-compatible extensions.
---

# cortex-extend

## Purpose

Let users extend Cortex with custom skills without needing to understand plugin structure, SKILL.md syntax, or hooks. The user describes what they want in plain language, and this skill provides the Cortex-specific rules that any skill-creation flow needs to generate a working companion plugin.

This skill does NOT generate skills itself. It captures the user's intent, injects Cortex compatibility rules, and hands off to whatever skill-creation capability is available.

## When this skill fires

**Literal triggers:**
- "I want Cortex to...", "make Cortex do..."
- "add a skill that...", "extend Cortex to..."
- "create a custom skill", "build me a skill"
- "I want a skill for...", "can Cortex learn to..."

See row 21 in `references/trigger-phrases.md`.

## Procedure

### Step 1 — Understand the user's intent

Restate what the user wants in one sentence. Example:

> "You want Cortex to automatically pull your Slack threads each morning and file them as meeting notes in the relevant project folder."

Ask 1-2 clarifying questions focused on:
- **What triggers it?** (a phrase, a schedule, a tool event, always-on?)
- **What does it read?** (vault files, MCP connectors, external APIs?)
- **What does it write?** (vault notes, changelog entries, hub updates?)
- **Where does it write?** (project Notes/, Knowledge Base/, a new location?)

Do not ask more than 2 questions. If the user's description is clear enough, skip to Step 2.

### Step 2 — Hand off to skill creation

Find the best available skill-creation capability, in priority order:

1. `skill-creator` (superpowers plugin) — if installed, invoke it
2. `create-agent-skills` or `create-agent-skill` — if available
3. Claude's native ability to write SKILL.md files and plugin scaffolds — always available as fallback

Hand off with this context injected:

> "Create a Cortex-compatible companion plugin following the rules in the Cortex Extension Rules section below. The user wants: [one-sentence description]. It should: [trigger, read, write, where]."

### Step 3 — Verify and install

After the skill-creation flow generates the companion plugin:

1. Verify the output follows the rules in the Cortex Extension Rules section
2. Help the user install it (register as a plugin or point Claude at the directory)
3. Confirm it will load alongside Cortex on the next session

## Cortex Extension Rules

**This is the reference document.** Any skill-creation flow — whether a dedicated skill-creator, "Create with Claude" in Desktop, or Claude writing files directly — must follow these rules when generating Cortex-compatible extensions.

### Structure

Companion skills live in a **separate plugin**, never inside the Cortex core plugin. The minimum structure:

```
my-cortex-extensions/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── my-custom-skill/
        └── SKILL.md
```

`plugin.json` minimum:

```json
{
  "name": "cortex-extensions",
  "description": "Custom Cortex companion skills.",
  "version": "0.1.0"
}
```

If the skill needs hooks, add `hooks/hooks.json` following the same format as the Cortex core plugin's `hooks/hooks.json`.

### Using Cortex MCP tools

The `cortex-vault` MCP server provides 10 tools that companion skills should prefer over manual file operations:

| Tool | Use for |
|---|---|
| `read_hub` | Reading a project's context hub (status, blockers, open questions) |
| `append_changelog` | Logging operations to `_changelog.txt` |
| `update_moc` | Adding entries to a folder's `_MOC.md` |
| `find_project_by_cwd` | Resolving cwd to a vault project |
| `list_projects` | Enumerating all projects in the vault |
| `scaffold_project` | Creating new project folder structures |
| `thread_meeting` | Linking meeting notes in a recurring series |
| `validate_frontmatter` | Checking frontmatter against vault conventions |
| `check_dormant_features` | Evaluating progressive feature activation signals |
| `open_question` | Adding or resolving open questions on project hubs |

These tools are available as `mcp__plugin_claude-cortex_cortex-vault__<tool_name>`. Always prefer them over reading/writing vault files directly — they enforce conventions automatically.

### Vault conventions to follow

**Frontmatter:** Every vault note needs YAML frontmatter with at minimum `created`, `updated`, `tags`. All tags must be quoted strings (the `#` is a YAML comment delimiter).

```yaml
tags:
  - "#source/custom-skill"    # correct
  - #source/custom-skill      # WRONG — becomes null
```

**Changelog logging:** Every vault write must be logged to `_changelog.txt` using the `append_changelog` MCP tool:

```
[YYYY-MM-DD HH:MM] ACTION | FILE: filename | DEST: relative/path/ | NOTE: context
```

**Wikilinks:** Use `[[wikilinks]]` for all internal links. Every note in a project folder should include `*Related:* [[_MOC]]` in its footer. Cross-link related notes bidirectionally.

**MOC updates:** When creating a file inside a folder that has a `_MOC.md`, update that MOC using the `update_moc` MCP tool.

**Routing rules:** Route content to the correct location based on type:

| Content type | Destination |
|---|---|
| Meeting notes | Project `Notes/` folder |
| Decisions, scope changes, blocker updates | Project hub via `cortex-update-context` |
| Reusable knowledge | `Knowledge Base/` |
| Unsorted or ambiguous | `_Inbox/` |

Read `personality.md` in the vault root for the user's specific folder structure and vocabulary.

### Respecting activation levels

Cortex operates at three levels depending on session context:

- **L1 (Passive):** Don't write to the vault without explicit user intent
- **L2 (Vault-Aware):** Can read vault state and write with Tier 1 capture signals
- **L3 (Full Project):** Proactive reads, but still requires explicit intent for writes from repo-context sessions

Companion skills should check the activation level before writing. If the session is L1, always ask before any vault operation.

### Resolving vault path

Never hardcode vault paths. Resolve the vault location from:

1. The `cortex-vault` MCP tools (they resolve it internally), or
2. `~/.claude/cortex/config.json` → `vault_path` field

### What NOT to do

- **Don't duplicate Cortex core behavior.** Don't create a second changelog logger, a competing boot sequence, or a parallel capture system.
- **Don't write to `personality.md` or `memory.md` directly.** These are managed by Cortex core. If a companion skill needs to persist state, use a dedicated file in the vault.
- **Don't create hooks that conflict with Cortex hooks.** If Cortex already has a `PostToolUse` hook that logs vault writes, don't create another one. Instead, read `_changelog.txt` for the data you need.
- **Don't assume a specific vault structure.** Always read `personality.md` for the user's bucket terms, project names, and folder layout.

## Worked examples

### Example 1 — User wants a standup generator

```
User: "I want Cortex to generate a standup summary each morning from
       yesterday's changelog entries"

Step 1 — Restate:
  "You want a skill that reads yesterday's _changelog.txt entries and
   writes a standup summary. Where should it go — Daily Briefings/,
   or a project Notes/ folder?"

User: "Daily Briefings is fine"

Step 2 — Hand off to skill creation with context:
  "Create a Cortex-compatible companion plugin. The user wants a skill
   called cortex-standup that:
   - Triggers on: 'standup', 'daily standup', 'what did I do yesterday'
   - Reads: _changelog.txt (yesterday's entries), personality.md (project names)
   - Writes: Daily Briefings/YYYY-MM-DD-standup.md
   - Uses MCP tools: append_changelog, update_moc
   - Follows the Cortex Extension Rules above."

Step 3 — Skill creation flow scaffolds the plugin, writes SKILL.md.
  Verify it follows the rules. Help install.
```

### Example 2 — User wants a sprint planner

```
User: "extend Cortex to pull my Monday.com board and create a sprint
       plan note in the project"

Step 1 — Restate:
  "You want a skill that reads a Monday.com board via MCP, summarizes
   the sprint items, and files a sprint plan note in the project's
   Notes/ folder. Which project — or should it ask each time?"

User: "it should figure it out from the board mapping in memory.md"

Step 2 — Hand off with context:
  "Create a Cortex-compatible companion plugin. The user wants a skill
   called cortex-sprint-plan that:
   - Triggers on: 'sprint plan', 'pull the board', 'what's on the sprint'
   - Reads: Monday.com MCP (board items), memory.md (board-to-project mapping),
     project hub (current blockers)
   - Writes: <project>/Notes/YYYY-MM-DD Sprint Plan.md
   - Uses MCP tools: read_hub, append_changelog, update_moc, thread_meeting
   - Follows the Cortex Extension Rules above."
```

## Failure modes

| Failure | What to do |
|---|---|
| No skill-creation capability available (no skill-creator, no create-agent-skill) | Fall back to Claude's native ability to write SKILL.md files. Scaffold the companion plugin directly. |
| User's request duplicates Cortex core functionality | Explain which existing skill already does this and how to use it. Don't create a duplicate. |
| User's request requires a hook that conflicts with a Cortex hook | Explain the conflict and suggest an alternative approach (e.g., read from _changelog.txt instead of duplicating the PostToolUse hook). |
| User wants to modify Cortex core, not extend it | Explain that Cortex core updates from the repo and their changes would be overwritten. Offer to build it as a companion skill that overrides or supplements the core behavior. |
| Companion plugin location is unclear | Default to `~/Documents/cortex-extensions/`. Ask the user if they prefer a different location. |

## What this skill does NOT do

- Does not modify the Cortex core plugin. Only creates companion plugins.
- Does not generate skills without user intent — never scaffolds proactively.
- Does not manage or update existing companion plugins. Each creation is independent.
- Does not publish plugins. It creates local plugins only.

## Related

- **References:** `references/trigger-phrases.md` (row 21), `references/vault-conventions.md`
- **MCP tools:** `mcp-servers/cortex-vault/` (all 10 tools)
- **Handoff targets:** `skill-creator`, `create-agent-skills`, `create-agent-skill` (external)
- **Triggers:** row 21 in `references/trigger-phrases.md`

---
name: cortex-onboarding
description: First-run setup for a new Cortex user. Walks the user through introducing themselves, installing Obsidian (if needed), creating a vault, answering 5 discovery questions about their work, connecting external tools via MCP, and building a personalized vault structure with a generated personality.md. Fires when ~/.claude/cortex/config.json is missing, when personality.md is missing from the vault, or when the user explicitly says "first run", "set up my vault", or "onboard me".
---

# cortex-onboarding

## Purpose

Turn a fresh Cortex install into a working vault in one session. This is the only skill that runs before a vault exists — every other skill assumes `personality.md` and `vault_path` are already in place.

The full playbook lives in `workflows/onboarding.md`. This SKILL.md is the routing + contract layer.

## When this skill fires

**Hard-route conditions** (cortex-boot hands off automatically):
- `~/.claude/cortex/config.json` does not exist
- `~/.claude/cortex/config.json` exists but `vault_path` is missing or points at a directory that doesn't exist
- `<vault_path>/personality.md` does not exist

**User-invoked conditions** (explicit trigger phrases):
- "first run", "just installed Cortex", "set up my vault", "onboard me"
- "I want to redo my Cortex setup" (triggers a partial reset flow — see Failure modes)

## Inputs

None required. The workflow collects all inputs interactively through the 5 discovery questions.

## Procedure

Run `workflows/onboarding.md` exactly. That workflow is 7 steps:

1. **Introduction** — one warm sentence, then ask the first question
2. **Obsidian setup** — detect platform, install Obsidian if needed, create or pick a vault location
3. **Discovery** — 5 questions, one at a time, each waiting for a response before asking the next
4. **Tool connection** — walk through MCP connector setup for each tool the user mentioned
5. **The Build** — write `~/.claude/cortex/config.json`, scaffold the vault folder structure, generate `personality.md` from captured values, populate `memory.md`, initialize `_changelog.txt`, copy rules from `references/`, copy templates from `assets/`
6. **Developer setup** — only if the user answered yes to "are you a developer?" — offers to register code repos
7. **Demo & close** — one proof-of-concept question to demonstrate vault-awareness works

The workflow is already detailed and behavioral. This skill adds guardrails around it, not step-by-step duplication.

## Guardrails

**Conversational tone.** Warm, encouraging, one question at a time. Never use the words "setup wizard", "onboarding flow", or "the skill". Never present a menu. You are just Claude, helping them get set up.

**Match the user's vocabulary.** If they say "clients" you say "clients". If they say "projects" you say "projects". Never impose your own terminology.

**Track captured values continuously.** The workflow lists every variable you need to hold in session state. If you reach Step 5 (The Build) without one of them, pause and ask — do not invent a default.

**Never block on one failed step.** If Obsidian install fails, a connector fails, a file write fails, log it, note what needs revisiting, and keep going. The only unrecoverable failure is not being able to write `~/.claude/cortex/config.json` at all — see Failure modes.

**Use the user's actual words in `personality.md`.** The `self_description` field must be the user's own sentence, not a sanitized rewrite. This is how Cortex learns the user's voice for later sessions.

## Worked examples

### Example 1 — Happy path, new user, developer

```
cortex-boot detects no config.json → hands off here.

Turn 1 (from this skill):
  "This is Cortex — a system that turns Claude and Obsidian into your second
  brain. By the end of this conversation, Claude will know your world and
  remember it across every future conversation. Let's get started."

Turn 2: Detect platform (macOS). Obsidian not installed.
  "First, we need Obsidian — it's a free app where your knowledge will live..."
  Walk through install, wait for confirmation.

Turn 3-12: Ask the 5 discovery questions one at a time, capturing values.

Turn 13: Connect tools (Gmail, Monday.com, Figma — all native MCP).

Turn 14: Announce the build: "Now for the exciting part..."
  Write config.json, scaffold vault, generate personality.md, pull 24h of
  activity from connected tools.

Turn 15: is_developer=true → offer repo registration.

Turn 16: Demo & close.

On exit: personality.md exists, config.json points at the new vault. Next
session will boot into L2 (Vault-Aware) directly.
```

### Example 2 — Resuming partial onboarding

```
cortex-boot detects config.json exists, vault_path valid, but personality.md
missing. Hands off here with reason="personality missing".

Turn 1:
  "Looks like your vault is already created but your personality file is
  missing. I'll pick up from the discovery questions — nothing we just built
  will be lost. Sound good?"

Skip Steps 1-2 (intro + Obsidian setup). Run Steps 3-7 normally.
```

### Example 3 — User says "onboard me" but vault already exists

```
User: "I want to redo my Cortex setup."

Turn 1:
  "Your existing vault is at <path> and has <N> projects and <M> meeting notes
  logged. Redoing setup would generate a new personality.md and config.json
  but won't delete any of your existing notes. Do you want to:
   1. Fully redo (new personality, new folders alongside existing ones)
   2. Just regenerate personality.md against your existing vault
   3. Cancel"

Default to option 2 unless the user explicitly picks 1. Option 1 is
destructive-adjacent (creates duplicate folders) and needs confirmation.
```

## Failure modes

| Failure | What to do |
|---|---|
| Cannot write `~/.claude/cortex/config.json` (permission denied) | Surface the exact permission error. Instruct the user how to fix it (e.g. `mkdir ~/.claude/cortex && chmod u+w ~/.claude/cortex`). Do not continue past Step 5.0. |
| Obsidian install fails | Provide the direct download link (https://obsidian.md/download). Walk them through manually. If they can't install, offer to continue and build the vault anyway — Obsidian can be opened against the vault folder later. |
| User picks a vault path that already contains files | Ask once: "That folder already has files in it. Create the vault alongside them, or pick a different location?" Never overwrite an existing file. |
| Connector authentication fails for a tool | Note as `available_not_connected` in `personality.md`. Continue with the next tool. Offer to retry after the build. |
| User wants to stop mid-flow | Save captured values to `personality.md` with `setup_status: incomplete`. Next session, `cortex-boot` detects the partial file and hands back here to resume. |
| User gives vague answers to discovery questions | Work with what you have. Use reasonable defaults (e.g., if no bucket_term given, default to "Projects"). Note the defaults in `personality.md` so they can be refined later. |
| `is_developer=true` but no repos mentioned | Skip Step 6.2 (repo registration). Inform the user they can say "register this repo" from inside any code repo later. |
| Vault creation fails (disk full, permissions) | Suggest `~/Documents/` as a first fallback, `~/Desktop/` as a second. If all fail, surface the system error and stop — this is unrecoverable without the user fixing their filesystem. |
| Pulled data from a connector is enormous (e.g. 10k emails) | Scope narrowly to the last 24 hours only. This is a taste, not a migration. |

## What this skill does NOT do

- Does not create projects. Project scaffolding happens in `cortex-ingest-project` after onboarding is complete.
- Does not run the Obsidian app for the user. Only tells them where to click.
- Does not modify an existing vault's content unless the user explicitly chose Option 1 in the "redo setup" flow.
- Does not install the claude-cortex plugin itself. The plugin is assumed to be already installed (otherwise this skill couldn't run).

## Related

- **Workflow:** `workflows/onboarding.md` — full 7-step playbook with discovery questions, personality template, and build order
- **References:** `references/progressive-features.md` (dormant-feature list for Step 5.7)
- **Assets:** `assets/blank-template.md`, `assets/repo-claude-stub.md`
- **Handoff targets:** `cortex-register-repo` (from Step 6.2 for developer users)
- **Triggers:** rows 1–3 in `references/trigger-phrases.md`

---
name: cortex-onboarding
description: First-run setup for a new Cortex user. Walks the user through an introduction, installing Obsidian if needed, creating a vault, five questions about their work, connecting tools, and building a vault structure with a generated personality.md. Fires when ~/.claude/cortex/config.json or personality.md is missing, or when the user says "first run", "set up my vault", or "onboard me". If no cortex-session block is present, call get_boot_context (mcp__plugin_claude-cortex_cortex-vault__get_boot_context) once; if it reports no vault, offer onboarding.
---

# cortex-onboarding

Turn a fresh Cortex install into a working vault in one session. Every other Cortex skill assumes `personality.md` and `vault_path` exist; this one creates them. Run `workflows/onboarding.md`, which points to the reference files under `references/onboarding/` as each situation comes up.

## When it fires

- `~/.claude/cortex/config.json` is missing, or its `vault_path` is missing or points nowhere. The session context block reports this at startup. If no <cortex-session> block is present, call get_boot_context (`mcp__plugin_claude-cortex_cortex-vault__get_boot_context`) once; if it reports no vault, offer onboarding.
- `<vault_path>/personality.md` is missing. Say the vault is already there, skip Steps 1-2, and pick up at discovery: "Your vault is already created but the personality file is missing. I'll pick up from the questions; nothing you have will be lost."
- "first run", "just installed Cortex", "set up my vault", "onboard me".
- "Redo my Cortex setup": show the vault path and what it holds, then offer (1) a full redo with new folders alongside the old, (2) regenerate `personality.md` only (the default), or (3) cancel. A full redo needs a clear yes, because it creates duplicate folders.

## What matters most

- Match the user: their tone register, their vocabulary on disk, their language. People who are terse, formal, writing in a second language, using a screen reader, or under 18 each need a different conversation (`references/onboarding/adapting.md`).
- Treat regulated data carefully from the first mention. Clinicians, lawyers, clergy, journalists, financial advisers, caseworkers, and anyone working with minors get no connector pitch, metadata-only pulls, a vault outside cloud sync, and a `.claude/rules/privacy.md`. Patient-record, student-record, and telehealth systems are never connected, because that data would leave the machine (`references/onboarding/compliance.md`).
- Capture without inventing. `self_description` stays verbatim; a missing value is asked for, not filled in (`references/onboarding/personality-schema.md`).
- Keep going when a step fails. Note it and move on; only a failed write of `~/.claude/cortex/config.json` stops the flow.
- Never overwrite an existing folder or vault file without asking.

## Out of scope

Creating projects (that's `cortex-ingest-project`, after onboarding), clicking around Obsidian for the user, changing an existing vault's notes (except the full-redo option), and installing the plugin itself.

## Closing check

Before the demo:

1. `~/.claude/cortex/config.json` parses and `vault_path` is the folder you built.
2. `personality.md` parses as YAML and has `identity`, `mental_model.bucket_term`, `tools`, and `progressive_features`.
3. Run `mcp__plugin_claude-cortex_cortex-vault__validate_frontmatter` on each hub and MOC you created, and confirm each MOC lists the files in its folder.

Show the result as a short list. Fix anything that fails before moving on.

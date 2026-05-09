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

1. **Introduction + contract + data residency** — one sentence intro, explicit shape ("5 questions, ~10 min"), proactive disclosure that the vault is local
2. **Platform / Obsidian / vault** — macOS, Windows, OR Linux branches; macOS Gatekeeper pre-warning; existing-vault detection with three modes (fresh / sandbox / metadata-only); accessibility check
3. **Discovery** — 5 questions, one at a time, with: tone-register detection, expanded vocabulary menu, two-level bucket nesting follow-up, secondary-axis probe, archetype detection (portfolio / queue / single_product / hybrid), industry-aware sub-note mapping, strict `is_developer` heuristic
4. **Tool connection — surface-aware** — Claude Code (CLI) vs Claude Desktop branches, hard cap at 2 tools, live registry check (not hardcoded table), regulated-industry skip
5. **The Build** — branched by `build_mode`; writes `~/.claude/cortex/config.json` with portable paths; scaffolds folders using user's vocabulary; archetype-aware folder shape; pulls last 24h (metadata-only if regulated); writes `.claude/rules/privacy.md` when compliance constraints exist
6. **Developer setup** — only if `is_developer = true`; platform-aware install (no Mac-only bash on Linux/Windows)
7. **Demo & close** — branches on whether connectors pulled data; concrete next-action close, no infomercial register

The workflow is detailed and behavioral. This skill adds guardrails around it, not step-by-step duplication.

## Guardrails

**Conversational tone, with adaptive register.** Default is one warm sentence per beat. If the user replies in ≤3 words, terse fragments, or signals "skip the pitch" → switch to terse mode for the rest of the session. Never use "setup wizard", "onboarding flow", "the skill", "exciting part", or "imagine the things you could do now".

**Match the user's vocabulary, on disk too.** If they say "matter" you write `Matters/`, not `Projects/`. If they say "punch list" you create `Punch List.md`, not `Deliverables Tracker.md`. The `self_description` field in `personality.md` must be the user's own words, never sanitized.

**Surface awareness.** Detect Claude Code (CLI) vs Claude Desktop before Step 4. Connector instructions diverge — CLI uses `claude mcp add <name>`, Desktop uses Settings → Connectors. Never tell a CLI user to "go to Claude settings".

**Compliance defaults.** If the user mentions HIPAA / PHI / privilege / GDPR / DSGVO / FERPA / ITAR / SOC2 / regulated / confidential, OR if industry implies it (law, healthcare, finance, gov, mental health, accounting, defense, ed): set `compliance_constraints`, default ALL connectors OFF, write `.claude/rules/privacy.md` during build.

**Two-level + cross-cutting hierarchies.** After Q2 ask the nesting follow-up ("does each [bucket] contain multiple distinct pieces of work?") and the secondary-axis probe ("anything that runs across all of them — vendors, contractors, stakeholders?"). Schema supports `child_term` and `secondary_axis`.

**Track captured values continuously.** If you reach Step 5 (The Build) without one, pause and ask — do not invent a default.

**Never block on one failed step.** Log the failure, keep going. Only unrecoverable failure: cannot write `~/.claude/cortex/config.json`.

**Don't leak Cortex internals into user-facing files.** YAML frontmatter is fine (machine-readable). The visible body of any file the user opens must not contain `bucket_term`, `tag_taxonomy`, `progressive_features`, `is_developer` as visible labels — use the user's words for headings.

**Accessibility.** If user signals screen reader / VoiceOver / NVDA / Orca: replace "watch your vault" with file-by-file spoken narration; skip echoing full paths and YAML in monospace; warn that Obsidian's macOS accessibility is rough and offer "vault folder + your usual editor" as an alternative.

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
| Cannot write `~/.claude/cortex/config.json` (permission denied) | Surface the exact permission error + fix command (e.g. `mkdir -p ~/.claude/cortex && chmod u+w ~/.claude/cortex`). Halt at Step 5.0. |
| Obsidian install fails OR user lacks admin rights (corp / IT-managed) | Switch to `obsidian_installed = false`, vault folder only, edit in any text editor. Continue the flow. |
| macOS Gatekeeper blocks first launch | Pre-warned in Step 2.3. If user still hits it: instruct right-click → Open → Open in dialog. |
| Windows SmartScreen blocks installer | Instruct: click "More info" → "Run anyway". |
| Linux platform | Step 2 has a Linux branch (AUR / Flatpak / AppImage). Step 6.1 install-desktop.sh is macOS-only and skips cleanly with a one-liner. |
| User picks a vault path that already contains files | Ask once: alongside / different name / cancel. Never overwrite. |
| Existing Obsidian vault detected | Offer 3 modes: `fresh` / `sandbox` (Cortex subfolder of existing) / `metadata_only` (personality+rules at root, no scaffold). Default to `sandbox`. |
| Connector authentication fails for a tool | Note as `available_not_connected` with reason. Continue. Offer retry post-build. |
| User refuses connectors due to compliance | Skip Step 4 entirely. Ensure 5.8 (privacy rules) runs. |
| User on regulated industry (law, healthcare, finance, gov, etc.) | Auto-set `compliance_constraints`. Default all connectors OFF. Write `.claude/rules/privacy.md`. Pull metadata-only if any cloud tool gets connected. |
| User wants to stop mid-flow | Save partial state to `personality.md` with `setup_status: incomplete`. Resume next session. |
| Vague discovery answers | Use sensible default with the user's first-mentioned vocabulary. Never invent terms. |
| `is_developer` mis-set on third-party mention ("we have devs") | Strict definition: only true on self-reference ("I code", "my repos"). Correct quietly if wrong. |
| `is_developer=true` but no repos | Skip Step 6.2. Tell user they can run "register this repo" later. |
| Vault creation fails (disk, permissions) | Try `~/Documents/`, then `~/Desktop/`. If both fail, surface system error and stop. |
| Pulled data enormous | Cap at 24h. Cap to metadata-only if `compliance_constraints` non-empty. |
| User has 3+ tools they want connected | Hard cap at 2 in Step 4. Queue rest for `/cortex-connect-tools` follow-up. |
| Screen-reader user | Replace "watch your vault" with file-by-file narration. Skip monospace YAML/path echoes. Offer "vault folder + your usual editor" instead of Obsidian. |
| Operational/queue archetype (>20 active items, no portfolio shape) | Do NOT scaffold one folder per item. Use single `<bucket_term>/` folder with `Active.md` log + template for new entries. |
| ESL user / locale mismatch | Avoid idioms ("falling through the cracks", "imagine the things"). Substitute literal phrasing. Honor any non-English vocabulary the user introduces. |

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

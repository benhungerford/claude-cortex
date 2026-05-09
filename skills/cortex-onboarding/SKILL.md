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

**Adaptive tone register — 4 levels.** Default `warm`. ≤3 words / fragments / "skip the pitch" → `terse`. Casual + emoji + lowercase → `casual`. Formal sentences with honorifics ("Sie", "Mr/Mrs", surname-san, "shall we proceed") → `formal`. Re-evaluate on Q1's free-text answer. **Never mirror archaic register** (no "shall I", "thee", surname-honorifics back) — match formality but speak naturally. Banned phrases: "setup wizard", "onboarding flow", "the skill", "exciting part", "imagine the things you could do now", "second brain" after Step 1.

**Trust register is separate from tone register.** Regulated / audit-paranoid / high-stakes users get `trust_register=high_disclosure` — explicit file inventories, provenance, audit trails — even when also terse.

**Match user vocabulary on disk.** If they say "matter" → `Matters/`. "Punch list" → `Punch List.md`. "Bereiche" → `Bereiche/`. "Manuscrits" → `Manuscrits/`. `self_description` in `personality.md` is verbatim — never sanitized. Honor non-English vocabulary; after 2-3 such terms, ask once: "Want any folder names in [language], or English everywhere?"

**Surface awareness.** Detect Claude Code (CLI) vs Claude Desktop before Step 4. CLI uses `claude mcp add <name>`. Desktop uses Settings → Connectors. **Ask if ambiguous** — many Mac users are in the desktop app. iPad / phone is NOT a viable surface — pivot to Mac/Win/Linux or accept iPad-as-viewer-only via iCloud sync.

**Compliance defaults — broad detection.** Auto-trip on any of: HIPAA/GDPR/FERPA/COPPA/CCPA/PCI/PSD2/DORA/MiCA/ITAR/SOC2/PHIPA/PIPEDA/KVKK/LGPD/LFPDPPP/DPDP/APPI/PIPL/PDPA/POPIA/RGPD/NHS Caldicott/BANT/NMC/CMPA/FINRA/SEC/IRS/AML/KYC/FTC Funeral Rule/IATF 16949/ISO 9001/27001/45001/ATEX/EU Machinery Directive/21 CFR Part 11/GxP/PSYPACT/Helseregisterloven/Säkerhetsskyddslagen/Official Secrets Act/KCSiE/DfE/Prevent/Ordine/152-FZ/IM8/etc. Plus industry words: patient/advisee/mentee/pupil/parishioner/source/whistleblower/asylum/refugee/minor/donor/casework/congregant/sacrament/confession/classified/NDA/intel/reservist. Plus privilege language: attorney-client/notarial-secrecy/Beichtgeheimnis/Seelsorgegeheimnis/seal-of-confession. Plus threat-model: source-protection/life-safety/dissident/exile/OpSec/dual-use. **Distinguish FERPA-as-institution from FERPA-as-student** (students are data subjects, not handlers — don't auto-trip). For minor users: parental confirmation required regardless of industry.

**Multi-axis schema.** `secondary_axes` is a **list**, not a single object. A funeral home (services + families + vendors + clergy), a hotel (rooms + staff + vendors + reviews), a journalist (investigations + sources + corpus), a freelance creator (clients + agencies + style libraries) — all need 2-5 cross-cutting axes. Capture all. Plus `parallel_threads` for top-level peers that aren't rosters (a dissertation, a memoir, the book project).

**Per-bucket variation.** `child_term`, `nested_buckets`, `archetype`, and `compliance` can vary per bucket. A job-hunter's vault has Projects (portfolio) + Applications (queue) + Learning (single-product). A freelancer with mixed NDA needs `bucket_compliance_overrides`. Honor reality.

**Hierarchy depth.** Some users need 3 levels: pharma platform → studies → analyses; chambers → pupils → matters; agency → clients → projects. Capture `grandchild_term` if needed.

**Three build modes.** `fresh` (full scaffold), `sandbox` (Cortex/ subfolder of existing vault, others untouched), `metadata_only` (personality + rules at root only — check for file-name collisions before writing).

**Cloud-sync collision check.** Before picking vault path, detect if `~/Documents/` is inside iCloud/OneDrive/Dropbox/Drive sync. For regulated users, default outside-sync (e.g. `~/Cortex/`).

**IT-managed / DLP awareness.** Probe corp Macs/PCs for install permission AND endpoint DLP that intercepts file writes by extension/content. .md is usually safe — warn against pasting IBANs/SSNs/PANs.

**Track captured values continuously.** Pause and ask if missing at Step 5 — never invent.

**Never block on one failed step.** Log it, keep going. Only halt: cannot write `~/.claude/cortex/config.json`.

**Don't leak Cortex internals into visible file bodies.** YAML frontmatter is fine. Headings and prose use the user's words.

**Accessibility — 5 dimensions.** Screen-reader (file-by-file narration, no monospace dumps), low-vision (offer non-Obsidian editor — Obsidian's a11y is rough), no-audio for deaf/HoH (refuse audio output paths, captions for video), sensory-predictability for autistic users (announce step transitions, list build files in advance), neurodivergence signals like ADHD (cap connectors at 2 hard, narrate motion during build).

**Privacy.md variants.** Match the use case: regulatory (HIPAA/GDPR) / opsec (NDA, source protection, cybersec) / clergy (canonical privilege) / minor (parental consent + connector defaults off) / mixed-NDA (per-bucket) / audit-mode (append-only changelog for ISO/FINRA/IATF/CFR Part 11). Multiple can stack.

**Co-installer acknowledgment.** If user mentions someone else set this up ("son Marcus", "daughter Rachel", "nephew") — name them in the close so they can pick it back up.

**Closing language must be plain.** For low-tech / minor / formal / heavy-ESL users, replace `/cortex-coach activate <feature>` with "tell me when you want help with [thing]". Power users get the slash command.

**ESL idiom screen.** For any non-English locale_hint, substitute idioms ("falling through the cracks" → "what you keep losing track of", "wire up" → "connect", "heads up" → "one quick thing", etc.). The Q5 prompt itself uses literal phrasing — no idiom in the workflow text.

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
| ESL user / locale mismatch | Avoid idioms ("falling through the cracks", "imagine the things"). Substitute literal phrasing per `<esl_substitutions>`. Honor any non-English vocabulary the user introduces; offer non-English folder labels after 2-3 such terms. |
| Self-identified minor (<18, especially <13) | Pause. Ask if parent/guardian present. Default ALL connectors OFF regardless of industry. Write minor-variant `.claude/rules/privacy.md` with parental-consent language. Plain-language close (no slash commands). COPPA-strict for <13. |
| Adult who works with minors (tutor / coach / clergy youth ministry / pediatric / teacher / social worker) | Append `minor_data` to `compliance_constraints`. Default connectors OFF for any tool touching minor's communications. |
| iPad / phone / tablet as primary device | Cortex needs a Mac/Win/Linux computer. Hard-pivot or accept iPad-as-viewer-only via iCloud Drive / Obsidian Sync. Never try to install on iPad. |
| Win XP / Win 7 / Chromebook / very old OS | Halt: explain Obsidian + Cortex don't run; revisit when current. |
| Cloud-sync collision (vault inside iCloud/OneDrive/Dropbox) | Detect and warn. For regulated users, default to outside-sync path (e.g. `~/Cortex/`). |
| Endpoint DLP intercept (corp Mac/PC) | Probe extensions/patterns at risk. Default to .md. Warn against pasting IBANs/SSNs/PANs. |
| Multi-axis hybrid (3-5 secondary axes) | `secondary_axes` is a list. Scaffold all as siblings — funeral home, hotel, journalist, freelancer with mixed clients, charity director, factory supervisor with multiple rosters all need this. |
| Per-bucket compliance variation (mixed NDA freelancer) | Set `bucket_compliance_overrides` keyed by bucket name. Per-bucket frontmatter flag. Refuse pulls/exports from NDA-bound buckets without per-session re-confirmation. |
| Three-level hierarchy (pharma platform → studies → analyses; chambers → pupils → matters) | Capture `grandchild_term`. Default `single_product` archetype assumes 2 levels — extend explicitly when needed. |
| Audit-mode (ISO 9001 / IATF 16949 / FINRA / CFR Part 11 / GxP / charity audit) | `audit_mode = true` → append-only `_changelog.txt`; refuse edits to past entries without explicit amendment flag; audit-trail variant of privacy.md. |
| Soft constraints (canon / craft / tradition / liturgical / halal / kosher / sharia) | Store separately in `soft_constraints` — not regulatory but binding. Iconographers, halal-finance traders, observant-religion users. |
| Exclude-on-ingest (reservist work, classified, patient session content, asylum cases) | First-class field. Future sessions refuse to ingest matching content; refuse paste, refuse capture, surface the refusal. |
| Restricted sub-notes (intra-vault tier — Cultural Protocol, Pastoral, Confessional) | `restricted_subnotes` list in personality.md. Future skills must check before surfacing in summaries. |
| Spotty wifi / live-registry call fails | Use cached reference table. Note staleness in close. |
| Co-installer mentioned ("son Marcus", "daughter Rachel") | Capture name + relationship. Acknowledge once. Mention at close: "If you get stuck, [name] can pick this back up at [vault_path]." |
| Pronouns volunteered (they/them, she/they, etc.) | First-class `pronouns` field in identity. Propagate to every future skill. Don't ask if not volunteered. |
| Multi-jurisdictional compliance (Australian + EU + Russian patient data) | Stack all regimes in `compliance_constraints`. Privacy.md names each. |
| Audit-paranoid + terse (CFO, regulated senior) | Set `trust_register=high_disclosure` separately from tone. Terse responses + explicit file inventories. |
| 3+ secondary axes named at Q2 | Capture all in `secondary_axes` list. Don't force one to be primary. |

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

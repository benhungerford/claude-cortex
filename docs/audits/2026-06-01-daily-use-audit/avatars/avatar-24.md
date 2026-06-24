---
avatar_id: "24"
persona: Privacy maximalist, fully offline, zero MCP connectors, suspicious of every write
surface: Claude Code CLI
audit_date: 2026-06-01
auditor: Subagent (claude-sonnet-4-6)
---

# Avatar 24 — Daily-Use Audit

## Persona

**Label:** Privacy maximalist, fully offline, zero MCP connectors, suspicious of every write

This user runs Claude Code strictly from the CLI. They have no cloud MCP connectors (no Granola, Fathom, Google Calendar, Gmail, Asana, Monday, etc.) — the cortex-vault MCP server is the only one present, and they treat it with suspicion. They work air-gap adjacent: no expectation of network calls leaving their machine during a session. Their vault contains genuinely sensitive professional notes. They notice every file write and demand to know why it happened.

---

## Simulated Day-in-the-Life

**Morning, 08:45.** Opens a Claude Code CLI session in `~/Documents/Projects/client-alpha-site/`. The session-start hook runs `boot-context.py`, which reads `personality.md`, `memory.md`, the global `_changelog.txt`, and `registry.json` — four files touched before the user has typed a single character. The vault path is also written to `~/.claude/cortex/plugin-data/session-cache/vault-path.txt`. The user sees nothing about any of this. If this is an L3 session (cwd matches a registered repo), the project hub is parsed and personal project details are loaded into the model context and transmitted to Anthropic's servers. The user cannot opt out of this per-session upload without disabling the plugin entirely.

**08:47.** User asks a simple question about CSS grid. The `user-prompt-submit` hook fires and scans the full prompt text through pattern-matching. Because the prompt happens to contain the word "reusable" (as in "I want a reusable CSS grid pattern"), the hook emits a `<cortex-hint>` tagging this as `cortex-knowledge` with confidence `medium`. Now the model is primed to ask "want me to extract this to Knowledge Base?" — about a CSS layout question the user had no intention of vaulting.

**09:10.** User is in an L3 session and mentions in passing: "Ashley confirmed the timeline." The `cortex-boot` capture watch fires a Tier 1 ambient capture — "client or collaborator preference stated" — and `cortex-update-context` silently writes to the Project Context hub and appends to `Changelog.md`, then to `_changelog.txt`. Three files written. The user gets a one-line confirmation. There is no undo, no dry-run, no "are you sure."

**10:30.** User pastes meeting notes from a call (20+ lines, speaker-label format). The `user-prompt-submit` hook detects transcript structure and hard-routes to `cortex-process-meeting`. The skill calls `cortex-update-context` which cascades writes to: the new meeting note file, `_MOC.md`, the project Context hub, `Changelog.md`, and `_changelog.txt`. The MCP tool `thread_meeting` runs and rewrites an *existing* prior meeting note to add a `*Next:*` link — a silent mutation of a file the user didn't touch. Total: 5-6 files written with one confirmation line.

**11:15.** User types "what's the status of client-alpha?" The `cortex-check-status` skill fires and calls `mcp__cortex-vault__read_hub`. The cortex-vault MCP server is running (`node bootstrap.js`), and on first invocation it will try `npm install` if `node_modules` is missing. This is a network call (npm registry) during what the user believes is an offline session.

**14:00.** User asks about a Cloudflare Workers pattern. `cortex-boot`'s Step 6 silently calls `recall_related` via the cortex-vault MCP. The `@huggingface/transformers` model (`Xenova/all-MiniLM-L6-v2`) is loaded. On first use this pipeline makes an outbound fetch to download the model weights from HuggingFace CDN — a network call the user never consented to and has no mechanism to disable without patching `embeddings.js` directly.

**17:00.** Session ends. The stop hook fires and reads `pending-memory.json`. If any `pending-memory` was queued (from ambient Tier 1 captures), it appends to `memory.md` silently. The hook also reads `pending-signals.json` and appends to `Knowledge Base/Growth/_signals.log` — a behavioral profiling log — without the user seeing any confirmation. The user has no way of knowing what went into that log today.

---

## Findings

### Finding 1 — Ambient Tier 1 capture writes vault without per-write confirmation (P0)

**Area:** capture

**Evidence:** `references/capture-rules.md:32` — "Tier 1 never asks permission." `references/capture-rules.md:84` — "The Invisible Rule: The user should be able to have a normal conversation with Cortex active and never notice capture happening." `skills/cortex-update-context/SKILL.md:3` — "Fires on … any Tier 1 capture surfaced by cortex-boot's ambient watch."

**Impact:** For a privacy maximalist, "invisible writes" are a data-integrity catastrophe, not a feature. A casual remark — "Ashley confirmed the timeline" — silently mutates the project hub and changelog without a prompt. The one-line confirmation arrives *after* the write is committed. There is no dry-run mode, no per-session "require confirmation for all writes" switch, and no way to pre-approve what the capture policy considers Tier 1. The user cannot audit what will be written before it is written.

**Suggested Fix:** Add a `write_mode` config field in `~/.claude/cortex/config.json` with values `silent` (current behavior), `confirm` (ask before every vault write), and `explicit-only` (never capture ambiently — only on literal trigger phrases). Default remains `silent` to preserve existing behavior; `explicit-only` should be the recommended setting in the privacy-maximalist onboarding path. Document the setting in `references/capture-rules.md`.

---

### Finding 2 — `@huggingface/transformers` pipeline makes outbound network call on first use (P0)

**Area:** privacy

**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js:14` — `extractorPromise = pipeline('feature-extraction', MODEL_ID)` where `MODEL_ID = 'Xenova/all-MiniLM-L6-v2'`. The `@huggingface/transformers` `pipeline()` function fetches model weights from HuggingFace CDN on first call if they are not already cached on disk. Line 13 sets `env.allowLocalModels = true`, but this does not disable remote fetching — it merely *allows* local models *in addition* to remote ones. There is no `env.allowRemoteModels = false` or equivalent offline-lock.

**Impact:** Every `recall_related` or `search_vault` call on a fresh install (or after cache eviction) silently reaches out to `huggingface.co`. The user has zero indication this is happening. For an offline/air-gap environment this is a hard blocker: the MCP server's two most-used tools become unavailable without network, and on first install they leak the fact that the user is running Cortex at all to a third-party CDN.

**Suggested Fix:** Add `env.allowRemoteModels = false` immediately after `env.allowLocalModels = true` in `embeddings.js:13`. Bundle or document a pre-download step (`node -e "require('./lib/embeddings').embed('warmup')"`) during install so the model is cached before the first session. Surface a clear error message if the model is absent and remote fetching is blocked: "Semantic search unavailable — run `cortex-index --warmup` to download the embedding model."

---

### Finding 3 — `bootstrap.js` runs `npm install` (network) on MCP startup (P1)

**Area:** boot

**Evidence:** `mcp-servers/cortex-vault/bootstrap.js:38` — `spawnSync('npm', ['install', '--silent', '--no-audit', '--no-fund'], …)`. This runs every time `node_modules` is absent or incomplete, which happens after any plugin update (the comment on line 15 explains: "Claude Code periodically re-extracts the plugin sources from the marketplace repo, which wipes this directory's node_modules/").

**Impact:** An offline user who updated Cortex while online but then goes offline before the next session will have their MCP server fail silently — and not understand why `recall_related` and `read_hub` return "Vault path not configured." errors. More critically, this is a silent `npm install` that runs at the elevated trust level of the MCP server process, which pulls arbitrary packages from the npm registry without user approval. For a user suspicious of writes and network calls, an opaque `npm install` during session boot is a trust violation.

**Suggested Fix:** Ship `node_modules` pre-bundled (or use a lockfile-pinned reproducible install). At minimum, detect the offline case (`npm install` exits non-zero due to network) and emit a human-readable error: "cortex-vault MCP dependencies are missing. Connect to the internet and restart Claude Code to install them, or run: `cd <plugin_dir> && npm install`." Do not run `npm install` silently during a user session.

---

### Finding 4 — `post-tool-use` hook writes to `_changelog.txt` for every vault file touched, including reads turned writes (P1)

**Area:** capture

**Evidence:** `hooks/post-tool-use:131-147` — The hook fires on `Write`, `Edit`, and all `mcp__obsidian__*` write tools. `hooks/hooks.json:17` — `PostToolUse` matcher covers `Write|Edit|mcp__obsidian__write_note|mcp__obsidian__patch_note|…`. `hooks/post-tool-use:196-210` — also triggers a background `reindex-one.js` call that opens the sqlite database and runs the HuggingFace embedder for every `.md` file written.

**Impact:** Every time the model makes a vault write — including the "Conflict Rule" response that writes a corrected entry, or a `validate_frontmatter` fix — the hook silently appends to `_changelog.txt`. The reindex spawns a background `node` process embedding the file. For the privacy-maximalist user: (a) they cannot disable this auto-logging without removing the hook entirely, (b) the background reindex process runs the HuggingFace model silently, and (c) the changelog accumulates a permanent record of every write including accidental or reversed ones (the reversal itself is logged, but the original write is already logged — no idempotent correction).

**Suggested Fix:** Add a `skip_auto_changelog` flag in `config.json` that suppresses the hook-level changelog append (the skill-level explicit `append_changelog` calls still fire). Separate the reindex trigger from the changelog trigger so users can disable background reindexing without losing changelog auditability.

---

### Finding 5 — Stop hook silently appends to `_signals.log` behavioral profile without disclosure (P1)

**Area:** privacy

**Evidence:** `hooks/stop:47-96` — The stop hook checks `pending-signals.json` and, if the Growth folder exists, appends typed entries to `Knowledge Base/Growth/_signals.log`. Entries include `domain`, `topic`, `depth`, and `mode` fields derived from the session's teaching-moment detection. `hooks/user-prompt-submit:173-178` — the `user-prompt-submit` hook tags prompts containing "explain", "why does", "how does", "walk me through", etc. as `teaching-moment`, which eventually feeds into the signals log.

**Impact:** Every session where the user asks explanatory questions generates entries in a behavioral profile (`_signals.log`) inside their vault. The user is never told this is happening. There is no mention of this log in `cortex-boot`'s SKILL.md, `capture-rules.md`, or any user-facing reference. For a privacy-maximalist user, discovering a hidden growth-profiling log is a serious trust violation — especially one driven by passive phrase detection rather than explicit opt-in.

**Suggested Fix:** Add `_signals.log` disclosure to `cortex-boot`'s session block (e.g., "Growth signals logged: N entries today."). Gate signals logging behind an explicit `coaching_signals: enabled` flag in `config.json` that defaults to `false`. The cortex-coach skill (opt-in) should enable it; the general session loop should not.

---

### Finding 6 — Tier 1 capture "client or collaborator preference stated" has no explicit destination guard (P2)

**Area:** capture

**Evidence:** `references/capture-rules.md:28-29` — "Client or collaborator preference stated → Project hub Contacts section" is listed as a Tier 1 signal that "never asks permission." `skills/cortex-update-context/SKILL.md:191-204` — the failure mode "Project unclear from context" says "Ask once" — but the Tier 1 capture path in `cortex-boot` Step 6 fires on ambient detection, before the model has confirmed the active project.

**Impact:** In an L1 session (cwd outside vault, no project yet resolved), a user casually mentions "Ashley prefers short emails." The capture-rules Tier 1 contract fires. The model attempts to write to a "Project hub Contacts section" — but which project? The failure mode says "ask once," but: (1) the user did not invoke any explicit write action, so being asked is itself unexpected, and (2) in practice the model may guess the closest project and write silently. For the privacy-maximalist, having personal preferences about a person written to a project file based on a casual conversational utterance — without being asked — is the worst-case over-capture scenario.

**Suggested Fix:** Require Tier 1 "client or collaborator preference" captures to always go through the Tier 2 ask-before-capturing path when the session is L1 or L2 (no confirmed project in focus). Only treat it as Tier 1 silent capture at L3, where the active project is unambiguous. Update `references/capture-rules.md` to note this per-level distinction.

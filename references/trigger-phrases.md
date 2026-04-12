# Trigger Phrases — canonical router input

Single source of truth for "what user input routes to what skill". This file eliminates fuzzy intent detection. Every trigger is either:

1. A **literal substring** that must appear in the user's message (case-insensitive, whole-word match preferred), or
2. A **structural signal** about the session itself (cwd state, first message, file shared, etc.)

Used by:
- Each skill's `description` YAML field (populated from this table to keep descriptions consistent and discoverable)
- The Stage 3 `UserPromptSubmit` hook, which matches messages against this table and injects `<cortex-hint>skill:<name></cortex-hint>` into the session context
- `tests/scenarios.md` — every test scenario picks its starting skill from this table

Update this file first when adding a new skill or changing a trigger. Changes here drive changes to the SKILL.md descriptions.

---

## Routing table

| # | Trigger (literal or structural) | Routes to | Notes |
|---|---|---|---|
| 1 | Session start, `~/.claude/cortex/config.json` missing or `vault_path` invalid | `cortex-onboarding` | Hard route. First-run. |
| 2 | Session start, `<vault_path>/personality.md` missing | `cortex-onboarding` | Partial onboarding — resume from where user left off. |
| 3 | Literal: "first run", "just installed Cortex", "set up my vault", "onboard me" | `cortex-onboarding` | User-invoked onboarding even if vault exists. |
| 4 | Session start, any runtime, vault present | `cortex-boot` | Always fires first turn to resolve cwd + load memory. |
| 5 | Literal: "what's the status of <X>", "where are we on <X>", "what's left on <X>", "what's blocking <X>", "status of <X>", "any open questions on <X>" | `cortex-check-status` | X must fuzzy-match a known bucket in `personality.md`. |
| 6 | Literal: "log that", "log this", "log it", "add this to the project", "add that to <X>" | `cortex-update-context` | Explicit write trigger. |
| 7 | Literal: "we decided", "decision:", "I'm going with", "going to go with", "final answer is", "we're using <X>" | `cortex-update-context` | Decision capture. |
| 8 | Literal: "new blocker", "blocker:", "this is blocking", "blocked by", "can't proceed until" | `cortex-update-context` | New-blocker capture. |
| 9 | Literal: "that's resolved", "blocker resolved", "unblocked", "we got <X>" (where X is a previously-logged blocker) | `cortex-update-context` | Blocker-resolved capture. |
| 10 | Literal: "new project", "start tracking", "I'm starting a new <project_term>", "scaffold a project for <X>" | `cortex-ingest-project` | |
| 11 | Structural: user pastes a long block of text (5+ lines) that looks like a project brief (mentions goals, deadlines, deliverables, stakeholders) and no existing project matches | `cortex-ingest-project` | Heuristic — if uncertain, ask "is this a new project or an update to <X>?" |
| 12 | Structural: user pastes a transcript — multi-line, "Speaker: text" format, or a Granola/Fathom/Gong export | `cortex-process-meeting` | Length threshold: 20+ lines. |
| 13 | Literal: "process this meeting", "here are the notes from <X>", "meeting notes:", "from my call with <X>" | `cortex-process-meeting` | |
| 14 | Structural: Granola / Fathom MCP tool returned a transcript in the current turn | `cortex-process-meeting` | Hard route. |
| 15 | Literal: "reusable", "worth remembering", "add to knowledge base", "file as a reference", "save this pattern", "for future projects" | `cortex-knowledge` | |
| 16 | Structural: conversation reveals a vendor quirk, library gotcha, or recipe not specific to the current project | `cortex-knowledge` | Soft trigger — ask user "want me to extract this to Knowledge Base?" |
| 17 | Literal: "register this repo", "link this folder", "link this repo to a project", "this repo is for <project>" | `cortex-register-repo` | |
| 18 | Literal: "scan for repos", "backfill repos", "find my project folders", "register all my repos" | `cortex-register-repo` | Backfill operation. |
| 19 | Structural: cwd outside vault, no registry match, `CLAUDE.md` with Cortex stub found walking up | `cortex-register-repo` | Orphaned stub — prompts "is this <closest-match>?" |
| 20 | Literal: "what project am I in", "what repo is this", "which project is this cwd" | `cortex-register-repo` | Read-only lookup. |
| 21 | Literal: "I want Cortex to...", "add a skill that...", "extend Cortex to...", "make Cortex do...", "create a custom skill", "build me a skill", "can Cortex learn to..." | `cortex-extend` | Hands off to skill-creation flow with Cortex compatibility rules. |
| 22 | Literal: "teach me", "teach me about", "teach me how", "teach me why", "what should I be learning", "where can I improve", "coach me", "how could I do this better", "what am I missing", "review my approach", "skill check", "growth check" | `cortex-coach` | On-demand coaching. Reads vault state + Claude expertise to deliver tailored guidance. |

---

## Structural signal definitions

**Session start:** first user message of a new Claude session. Detected via absence of prior assistant messages in the current conversation. Every session start fires `cortex-boot` first.

**Long text paste:** user message contains 5+ lines AND has at least one paragraph of prose. Different from a structured transcript (which has speaker labels).

**Transcript paste:** user message has 20+ lines AND includes speaker-labeled lines (`Name: text`) OR is returned by a Granola/Fathom MCP tool in the same turn.

**Orphaned stub:** walking up from cwd finds a `CLAUDE.md` whose first 20 lines contain the phrases "Cortex-managed repo" or "invoke the Cortex skill", but `resolve-cwd` returns no registry match.

---

## Disambiguation rules (when two triggers fire)

More than one trigger can match a single message. The routing hook picks in priority order:

1. **Hard-route structural signals win** (onboarding missing config, transcript from Granola MCP, etc.)
2. **Explicit trigger phrases beat inferred ones** ("log that the API is Stripe" → `cortex-update-context`, not `cortex-knowledge`)
3. **Write-side beats read-side** ("log the status of FKT" → `cortex-update-context`, not `cortex-check-status`)
4. **If two write-side triggers fire simultaneously** (e.g. a decision AND a blocker in one sentence), route to `cortex-update-context` and let it handle both captures in one pass.

If no trigger matches and the user is at Level 1, Cortex answers the question directly without invoking any skill beyond `cortex-boot`.

---

## Soft matching guidelines (for phrase triggers)

- Case-insensitive.
- Ignore surrounding punctuation.
- Whole-word match preferred over substring — "log" alone should not trigger `cortex-update-context` (it matches "logger", "login", "catalog"). But "log that" or "log this" or "log it" should.
- Project-name matching is fuzzy: "FKT", "Frankl and Thomas", "fkt shopify" all match the Frankl & Thomas bucket.
- If a phrase *almost* matches (one word off), Cortex can ask: "Did you mean `log that`?" — but only once per conversation.

---

## Adding a new skill

When adding a new skill to the plugin:

1. Add its triggers to this table with a new row number.
2. Copy the trigger line verbatim into the new skill's `description` YAML field so Claude's skill-loader sees the same phrasing.
3. Add at least one test scenario to `tests/scenarios.md` that exercises each new trigger.
4. If the new trigger overlaps an existing one, update the Disambiguation rules section above.

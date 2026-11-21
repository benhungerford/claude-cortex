# Trigger phrases

Which input routes to which skill. The literal phrases live in two places that matter: each skill's `description` (what Claude's skill loader sees) and the patterns in `hooks/user-prompt-submit`, which add a `<cortex-hint>skill:<name></cortex-hint>` to the prompt. When they disagree, the hook's patterns are what actually fire. This file keeps what neither of those holds: the routing map, structural signals, and how to break ties.

## Routing map

| Input | Skill |
|---|---|
| No `~/.claude/cortex/config.json`, bad `vault_path`, or no `personality.md`; "first run", "set up my vault", "onboard me" | `cortex-onboarding` |
| Status questions about a known project ("what's the status of", "where are we on", "what's blocking", "catch me up on"; plain-English and second-language forms such as "where we at") | `cortex-check-status` |
| "log that", decisions ("we decided", "going with"), new blockers, resolved blockers ("that's resolved"; "we got the X" at medium confidence, so the skill confirms which blocker) | `cortex-update-context` |
| "new project", "start tracking", a pasted brief with no matching project | `cortex-ingest-project` |
| "process this meeting", a pasted transcript, a Granola/Fathom tool result | `cortex-process-meeting` |
| "worth remembering", "add to knowledge base", "this is reusable" (bare "reusable" doesn't fire); an ambient vendor quirk or recipe, asked first | `cortex-knowledge` |
| "register this repo", "scan for repos", "what project am I in", an orphaned stub | `cortex-register-repo` |
| "I want Cortex to…", "add a skill that…", "create a custom skill" | `cortex-extend` |
| "teach me", "coach me", "where can I improve", "skill check" | `cortex-coach` |
| "set up my daily routine", "build my daily briefing", `/cortex-daily`, a yes to the `daily_briefing` offer | `cortex-daily` |

Session start needs no skill: the session-start hook injects the context block (level, active project, blockers) and the behavior that goes with it. On a surface without hooks, the `get_boot_context` MCP tool returns the same block.

## Structural signals

- **Brief paste:** 5+ lines with at least one paragraph of prose about goals, deadlines, deliverables, or stakeholders. If unsure, ask "new project or an update to X?"
- **Transcript paste:** 20+ lines where speaker-labeled lines are at least 25% of the total. Labels come as `Name:`, `First Last:`, Granola `**Name:**`, Fathom `[HH:MM] Name:`, or `- Name:`. A citation block (Author, Title, DOI, Year, Journal) is not a transcript. Timestamped pastes route at high confidence; untimestamped ones at medium, so the skill asks "file this as a meeting, or keep it as context?"
- **Orphaned stub:** walking up from the cwd finds a `CLAUDE.md` whose first 20 lines say "Cortex-managed repo" or "invoke the Cortex skill", but no registry entry matches.

## When two triggers match

1. Hard structural routes win (missing config, a Granola/Fathom transcript).
2. Explicit phrases beat inferred signals: "log that the API is Stripe" goes to `cortex-update-context`, not `cortex-knowledge`.
3. Writes beat reads: "log the status of FKT" is an update, not a status check.
4. A decision and a blocker in one message both go to `cortex-update-context` in one pass.

With no match at L1, just answer the question.

## Matching

Case-insensitive, punctuation ignored, curly apostrophes treated as straight. Prefer whole phrases: "log" alone shouldn't fire (logger, login, catalog), "log that" should. Project names match fuzzily ("FKT", "Frankl and Thomas", "fkt shopify"). If a phrase almost matches, ask "Did you mean 'log that'?" at most once per conversation.

## Adding a skill

Add a row here, put the same phrases in the skill's `description`, add the patterns to `hooks/user-prompt-submit`, add a scenario to `tests/scenarios.md`, and update the tie-break rules if the new trigger overlaps an old one.

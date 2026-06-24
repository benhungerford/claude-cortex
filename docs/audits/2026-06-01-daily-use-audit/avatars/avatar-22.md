---
avatar: 22
persona: Brand-new user, day 1 post-onboarding — near-empty vault, no registered repos, empty-state daily behavior
surface: Claude Desktop
auditor: claude-sonnet-4-6
date: 2026-06-01
---

# Avatar 22 — Day 1 Post-Onboarding Audit

## Persona

**Who:** A brand-new Cortex user who completed onboarding yesterday. Their vault exists, `personality.md` is present, `memory.md` is empty or has one or two lines, `_changelog.txt` has fewer than 50 entries, `registry.json` is empty (no registered repos), and `_Inbox/` is empty. They have no Granola or Fathom connection. They are opening Claude Desktop for the first time as a Cortex user.

**What they know:** They followed the onboarding flow, so they know Cortex watches their work and can capture decisions. They have not yet wired any repos, scaffolded any projects from inside Cortex, or run a meeting processing flow. Their vault has the folder skeleton but almost no notes.

---

## Simulated Day-in-the-Life

**Morning — session opens, L1 boot.**
The user opens Claude Desktop from their home directory (`~/`). The session-start hook fires, `boot-context.py` runs. Config exists, `personality.md` exists (freshly created by onboarding). `registry.json` is empty, so `resolve_cwd` returns level 1. `memory.md` is empty. `_changelog.txt` has 6 entries (the onboarding scaffolding). `_Inbox/` is empty. `check_dormant_features` returns `None` because `changelog_total < 50`. The `<cortex-session>` block is injected: Level L1, no project, no active_projects output (the `extract_buckets` call runs but returns empty if personality buckets aren't populated yet). The model invokes `cortex-boot`, reads L1, stays silent. Good start.

**First task — user asks a general question.**
"Hey, can you help me draft a quick email?" — L1 passive, Cortex stays out of the way. The user-prompt-submit hook runs, lowercase matches none of the hardcoded patterns, outputs `{}`. Cortex answers the email question. No capture fires. This works as intended.

**Mid-morning — user types a decision trigger.**
"We decided to go with Webflow for the client site." The user-prompt-submit hook pattern-matches `*"we decided"*` and injects `<cortex-hint>likely-skill: cortex-update-context | confidence: high | trigger: "decision trigger"</cortex-hint>`. `cortex-update-context` fires. It needs a project. But the vault has no scaffolded projects. The skill's failure-mode table says: "Project unclear from context → Ask once." But the underlying MCP tool `open_question` requires `project_path` and the `scaffold_project` tool has never been run. The skill and workflow both say "do not auto-create — hand off to `cortex-ingest-project`." So Cortex asks: "Is this for an existing project, or should I scaffold a new one?" The user says "new one." `cortex-ingest-project` fires. The user gets asked the full scaffolding question set. This is the expected path — but it means the user's first attempted capture on Day 1 hits a multi-step detour before the decision lands anywhere.

**Late morning — ambient recall fires on a near-empty vault.**
User is now working on a Shopify task. `cortex-boot`'s ambient recall step calls `recall_related` with `context: "setting up Shopify checkout"`. The sqlite-vec DB (`vault/.cortex/search.db`) has been indexed — but with a near-empty vault, the indexed note count is tiny (maybe 6–8 stub files from scaffolding). Every result will have a low cosine similarity score. The skill rule is: "Only surface results that have `score > 0.5`. Everything below that is noise." On a near-empty vault, almost nothing clears this threshold. Recall silently produces nothing. **This is the correct behavior**, but the user never gets acknowledgment that recall is happening or that it will get better as the vault fills. There is no Day 1 "recall is warming up" affordance anywhere.

**Noon — user pastes a short meeting summary.**
"From my call with the client: we're targeting a soft launch mid-July. They want a homepage and two interior pages." The user-prompt-submit hook matches `*"from my call with"*` and hard-routes to `cortex-process-meeting`. The skill fires. Step 1: identify context. No project exists in the vault yet (or one was just scaffolded in the morning detour). The skill asks: "Which project does this meeting belong to?" User names the project. The skill then looks for the `Notes/` folder to file the meeting note. If the project was scaffolded via `scaffold_project`, the `Notes/` folder and `Notes/_MOC.md` are created. Filing proceeds. But the threading step (`thread_meeting` MCP tool) looks for prior meetings in `Notes/`. There are none. This is handled gracefully: first-in-series, no threading. Meeting note is created. So far so good.

**Afternoon — user asks a status question about the project they just scaffolded.**
"What's the status of the Webflow project?" The user-prompt-submit hook matches `*"what's the status"*` and routes to `cortex-check-status`. The skill fires, calls `read_hub`. The hub file exists (scaffolded this morning). But the scaffolded hub template from `scaffold_project.js` uses `## Open Questions`, `## Key Decisions`, `## Blockers`, and `## Current Phase` sections — **not** the `## Stage Tracker` and `## Open Questions & Blockers` table sections that `boot-context.py::parse_hub` expects. `parse_hub` returns `stage: None` and empty blockers because neither regex finds its target. The L3 session block (if the user had registered a repo) would show no stage and no blockers — silently wrong. `cortex-check-status` reads the file directly via `read_hub` MCP tool and returns what it sees, which is the raw stub content. The user gets a "stub" answer that says the project is in Planning with no decisions yet — accurate, but confusing because the hub sections look different from what the docs show.

**End of day — stop hook fires.**
`pending-memory.json` doesn't exist (no memory updates were queued today — the session was Day 1 with no coaching activity). The stop hook checks for `SIGNALS_PENDING` (`pending-signals.json`), which also doesn't exist. It checks for `PENDING_FILE` (`pending-memory.json`), which doesn't exist. Outputs `{}`. Clean exit. No data loss.

**Overall Day 1 experience:** The session boots, the hooks fire, and the system works — but the user encounters: (1) a mismatch between the hub template produced by `scaffold_project` and the sections `parse_hub` expects; (2) a recall system that silently does nothing on a near-empty vault with no Day 1 orientation; (3) a first-capture moment that routes through a multi-step scaffolding detour before anything lands; (4) the `check_dormant_features` function with a hardcoded `weekly_review` string check that would never fire for a Day 1 user; and (5) a `user-prompt-submit` transcript detector that counts lines and speaker labels from `$INPUT` passed as a shell argument (a large paste could hit shell argument length limits on some platforms).

---

## Findings

### Finding 1 — Hub template sections mismatch what parse_hub expects (P0)

**Title:** Scaffolded project hub is unparseable by boot-context.py at L3

**Evidence:** `scaffold-project.js:176-183` generates a Project Context hub with sections `## Overview`, `## Current Phase`, `## Open Questions`, `## Key Decisions`, `## Blockers`. `boot-context.py:185-224` (`parse_hub`) searches for `## Stage Tracker` (a markdown table with `In Progress`/`Current` status column) and `## Open Questions & Blockers` (a 5-column table). Neither regex will ever match a freshly scaffolded hub, so `parse_hub` returns `stage: None`, `blockers: []`, `open_questions: []` for every new project. An L3 session opened in a newly scaffolded project repo would show: `<project> — None stage. 0 blockers.` — misleading on the first real use of L3. Additionally, `open_question.js:32-59` writes `- [ ] <text>` items under `## Open Questions`, not into the 5-column table `parse_hub` scans. So blockers added via the MCP tool are also never surfaced at boot.

**Impact:** Every new user on Day 1 scaffolds a project, registers a repo, opens an L3 session, and sees no stage and no blockers even after adding open questions. The boot context is silently empty for the most critical vault data. This will appear as a Cortex bug to Day 1 users.

**Suggested fix:** Either (a) update `scaffold_project.js` to emit the `## Stage Tracker` markdown table and `## Open Questions & Blockers` 5-column table that `parse_hub` expects, or (b) update `parse_hub` to also parse the freeform `- [ ]` checklist format and the `## Current Phase` section. Option (a) is canonical — the hub template should match the parser.

---

### Finding 2 — open_question.js writes checklist items, parse_hub reads a 5-column table (P1)

**Title:** Blocker additions via MCP tool never appear in L3 boot context

**Evidence:** `open_question.js:32-59` (`addQuestionToBody`) appends `- [ ] <text>` to the `## Open Questions` section. `boot-context.py:206-224` (`parse_hub`) scans for a 5-column pipe-delimited table under `## Open Questions & Blockers`. The two formats are entirely different. Even if the hub template were fixed to include the table (Finding 1 fix), any question added via `open_question` would be a checklist item in a different section, never read by `parse_hub`. The only way a blocker surfaces in the L3 boot block is if it was manually entered as a table row in the exact `## Open Questions & Blockers` section with exactly 5 cells.

**Impact:** The primary MCP write path for blockers (`open_question` action=`add`) produces output that is invisible to the boot context reader. A user who adds a blocker via "new blocker: Stripe creds" sees it confirmed in chat, but the next L3 session opens with 0 blockers. This is a silent data-accuracy regression on every session after the first capture.

**Suggested fix:** Converge on one format. Either update `open_question.js` to write table rows matching the 5-column format `parse_hub` expects, or update `parse_hub` to parse `- [ ]` checklist items from `## Open Questions` (and treat them all as blockers). The checklist format is simpler to maintain; if chosen, `parse_hub`'s table regex branch should be kept as a fallback for existing hubs that do use the table format.

---

### Finding 3 — user-prompt-submit passes full prompt as shell argv, not stdin (P1)

**Title:** Large prompt pastes can silently fail trigger detection via ARG_MAX breach

**Evidence:** `hooks/user-prompt-submit:33-40` extracts the user prompt by calling `python3 -c "..." "$INPUT"` where `$INPUT` is the raw stdin JSON passed as a positional shell argument (`sys.argv[1]`). On macOS/Linux, `ARG_MAX` is typically ~256 KB (macOS: 1 MB with `sysconf`), but the full JSON envelope (which includes the full prompt text) is passed on the command line. If a user pastes a large meeting transcript (say 5,000 words, ~30 KB) the JSON envelope is ~30–40 KB. This is within ARG_MAX on macOS, but on Linux systems with default ARG_MAX of 131072 bytes (128 KB), a very large paste could cause `python3 -c ... "$INPUT"` to silently fail with `Argument list too long`, the `|| true` on line 40 swallows the error, `USER_PROMPT` is empty, the hook outputs `{}`, and the transcript is never routed to `cortex-process-meeting`. The user pastes a meeting and gets a generic response — no routing hint fires.

**Impact:** Meeting transcripts are one of the highest-value Day 1 interactions. Silent mis-routing means the user pastes their first meeting, nothing routes, they type the full content into chat manually, and Cortex does nothing structural. High frustration moment.

**Suggested fix:** Change the Python invocation to pass `$INPUT` via a temp file or via here-string to `stdin` rather than as `argv[1]`. Example: pipe `$INPUT` via stdin and use `sys.stdin.read()` in the Python snippet. This matches the pattern already used in `hooks/session-start:44` (`python3 -c "..." <<< "$BOOT_JSON"`).

---

### Finding 4 — recall_related on a near-empty vault always returns below-threshold scores with no user orientation (P2)

**Title:** Ambient recall silently does nothing on Day 1; no "warming up" signal

**Evidence:** `cortex-boot/SKILL.md:85-88` instructs: "Only surface results that have `score > 0.5`. Everything below that is noise. If no results clear the threshold, say nothing about the recall." `recall-related.js:81-86` computes scores as `1 - distance/2` using sqlite-vec cosine distance from `Xenova/all-MiniLM-L6-v2`. With 6–8 stub files in the vault (scaffold output, personality, memory), the embedding space is nearly degenerate — all notes are semantically distant from any real query. Every Day 1 `recall_related` call returns 0 results above 0.5. The model says nothing. This is technically correct behavior, but the user has no indication that recall is happening in the background, that it will improve as the vault fills, or that they need to run `/cortex-index` to seed the DB.

**Impact:** Ambient recall is listed as a core daily-loop feature in the skill and references. On Day 1 it is entirely invisible and non-functional. There is no "index your vault to enable search" prompt, no first-use hint, and no progressive disclosure. The user's mental model of "Cortex watches and surfaces related notes" is never validated on their first day.

**Suggested fix:** Add a one-time session hint (emitted at most once per session, only when `inbox_count == 0` and `changelog_total < 20`) that surfaces after the first `recall_related` call returns 0 results: "Your vault is fresh — recall will improve as notes accumulate. Run `/cortex-index` to seed the search DB." This can be implemented as a session-scoped flag in the cortex-boot procedure without any file writes.

---

### Finding 5 — dormant feature check hardcodes "weekly_review" string, will never fire for non-standard personality setups (P2)

**Title:** check_dormant_features is hardcoded to one feature name and ignores all others

**Evidence:** `boot-context.py:367-378` (`check_dormant_features`) only returns a suggestion if `changelog_total >= 50` AND the personality YAML's `dormant` list contains the literal string `"weekly_review"`. Any other dormant feature listed in `personality.md` is silently ignored. On Day 1 this is moot (changelog < 50), but the design flaw is visible: the function is documented as a generic "check if any dormant features should be suggested" mechanism, but it implements exactly one hardcoded check. If the onboarding flow adds other dormant features to `personality.md` (e.g., `coach`, `backfill`), they will never surface via this path.

**Impact:** Lower severity on Day 1 (threshold not reached), but the feature's extensibility is broken from day one. Any future dormant feature added to the personality schema will require a new hardcoded branch here — the abstraction leaks. The `check_dormant_features` MCP tool in `server.js:25` exists separately, suggesting the intent was to generalize this, but the boot-context version never caught up.

**Suggested fix:** Generalize `check_dormant_features` to iterate over all items in the `dormant` list and return the first one that clears the threshold (or a list of all ready ones). The threshold can remain per-feature if needed, but the function should not contain feature-name strings — it should be data-driven from the YAML itself.

---

### Finding 6 — scaffold_project.js omits the "Stage Tracker" table and creates an "Open Questions" section instead of "Open Questions & Blockers" table — cortex-check-status fallback reads a stub, not structured data (P2)

**Title:** cortex-check-status on a new project returns stub text, not a structured answer

**Evidence:** When `cortex-check-status` calls `read_hub` for a newly scaffolded project, it receives the raw file content from `scaffold_project.js:174-183`: `## Overview\n\n\n## Current Phase\n\n\n## Open Questions\n\n\n## Key Decisions\n\n\n## Blockers\n\n\n`. The skill's procedure (step 4) says "Surface a focused status summary: health, stage, blockers, last 2-3 decisions." With stub content, Claude must answer from the raw structure, not parsed fields. The answer will be: "The project is in Planning (status from frontmatter), no open questions, no blockers, no decisions yet" — which is technically accurate but feels hollow. More importantly, the section headers in the hub don't match the section-guide.md expectations (which references "Stage Tracker" and "Open Questions & Blockers"), so any skill that uses those headers for orientation will silently miss the sections.

**Impact:** Day 1 users who immediately ask "what's the status?" after scaffolding get an answer from stub-format content rather than from the intended structured tables. The experience is fine for Day 1 (no data exists yet) but breaks progressively as the user adds data via the MCP tools into the wrong section format (findings 1 and 2 compound this).

**Suggested fix:** This finding is addressed by the same fix as Finding 1 — align the scaffold template with the sections the parsers and skills expect. Additionally, `cortex-check-status` should detect when the hub is a stub (no non-empty sections beyond frontmatter) and respond with: "This project was just scaffolded — no status data yet. As you log decisions and blockers, they'll appear here."

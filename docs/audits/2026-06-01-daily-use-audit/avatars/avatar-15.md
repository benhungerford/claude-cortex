---
avatar_id: "15"
persona: "Data scientist — notebooks + git repos, L3 sessions, logs experiment decisions"
surface: "Claude Code CLI"
date: 2026-06-01
auditor: claude-sonnet-4-6
---

# Daily-Use Audit — Avatar 15 (Data Scientist, L3)

## Persona

A data scientist who works across multiple git repos (one per project / experiment set), keeps Jupyter notebooks alongside Python scripts, runs Claude Code from inside those repos, and uses Cortex at L3 to log modeling decisions, track blockers like "waiting on GPU quota approval" or "feature store schema not finalized", and process meeting transcripts from data-review calls. They log decisions like "we're going with XGBoost instead of LightGBM for now", surface blockers to stakeholders, and want Cortex to maintain a clean decisions trail in their project vault.

---

## Simulated Day in the Life

**8:45 AM — Morning session, opens Claude Code from `~/projects/churn-prediction/`**

The `session-start` hook fires, `boot-context.py` runs. It reads `config.json`, `personality.md`, `memory.md`, the last 15 lines of `_changelog.txt`, and walks up from `cwd` matching against `registry.json`. The churn-prediction repo is registered, so activation level computes as L3. The boot script reads the project context hub, parsing `## Stage Tracker` (table format) for the stage and `## Open Questions & Blockers` (also table format, per `blank-template.md`) for blockers.

The session block is injected, `cortex-boot` fires, and the opening line surfaces: `Churn Prediction — Feature Engineering stage. 2 open blockers: GPU quota pending; feature store schema pending team sign-off. Ready.`

**9:10 AM — "we're going with XGBoost for the tree ensemble, not LightGBM"**

The `user-prompt-submit` hook fires on "we're going with", matches the decision trigger at `hooks/user-prompt-submit:93` (`*"we're using "* → cortex-update-context`). A `<cortex-hint>` is injected. `cortex-update-context` fires, reads the hub and tech sub-note, finds no contradiction, writes the decision to the Changelog and logs to `_changelog.txt`. `post-tool-use` fires on the Write, calling `reindex-one.js` in the background to re-embed the updated file.

**9:55 AM — Runs a notebook experiment, switches to `~/projects/churn-prediction/notebooks/` subdirectory in a separate terminal, opens another Claude Code session**

New session. The hook fires, `boot-context.py` runs. `cwd` is `~/projects/churn-prediction/notebooks/` — the walk-up hits the repo root `~/projects/churn-prediction/`, which is in the registry. Still L3. Good. But the user expects this to feel "same project" — and it does.

However: the user also does git worktree checkouts: `git worktree add ../churn-prediction-experiment feature/alt-features`. They open Claude Code from `~/projects/churn-prediction-experiment/`. That path does NOT appear in `repo_paths` for the project — only the root repo does. Boot resolves L1 (unregistered cwd), no project context is loaded. The user assumes L3 and starts logging decisions — none are captured to the right project vault.

**11:30 AM — "we got the GPU quota — clearing that blocker"**

The `user-prompt-submit` hook matches "unblocked" at `hooks/user-prompt-submit:104`. `cortex-update-context` fires. It calls `open_question` MCP tool to resolve the matching open question.

Here the divergence hits: the tool's `resolveQuestionInBody` (`open-question.js:63-79`) looks for `- [ ]` checkbox lines in `## Open Questions`. But the canonical blank template (`assets/blank-template.md`) and `boot-context.py`'s parser both expect `## Open Questions & Blockers` with a **pipe-delimited markdown table** (`| # | Question / Blocker | Type | Owner | Status |`). The MCP tool writes to the wrong section name and format. If the hub was scaffolded from the template, `open_question` silently creates a new `## Open Questions` checkbox section at the end of the file instead of modifying the existing table — and the boot-context parser at next session still reads the unmodified table, so the blocker appears unresolved at the next L3 boot.

**1:15 PM — Processes a data review meeting: pastes a 35-line transcript from Zoom**

The `user-prompt-submit` hook fires. The transcript detection runs: `LINE_COUNT=35 >= 20` and `SPEAKER_COUNT >= 3` (lines like "Alice: the F1 on the holdout set is 0.82"). Routes to `cortex-process-meeting`. The skill processes the transcript, creates the meeting note, calls `thread_meeting` MCP tool.

Threading works correctly for the notes folder. Meeting note is filed. Decisions are handed off to `cortex-update-context`.

**2:45 PM — Asks "what's the status of this project?" (no project name)**

`cortex-check-status` fires. The skill fuzzy-matches and reads the hub. It calls `read_hub` MCP tool. The tool's `extractOpenQuestions` (`read-hub.js:44-52`) looks for `## Open Questions` with `- [ ]` items. Because the hub was scaffolded from the canonical template which has `## Open Questions & Blockers` as a **table**, `extractOpenQuestions` returns an empty array. The status summary reports "no open questions" even though the table has 2 active items. The data scientist sees zero blockers and proceeds without awareness of the pending GPU quota issue (even though it's in the file).

**4:00 PM — End of day, Claude Code session ends, stop hook fires**

The stop hook checks for `pending-memory.json` and `pending-signals.json`. The teaching-moment detection in `user-prompt-submit` tagged the afternoon's "explain why XGBoost regularization differs from LightGBM" exchange as a teaching moment — but `pending-signals.json` is never written during the session (no code path creates it outside of `cortex-coach`). The stop hook checks for the file, finds it absent, skips silently. Teaching moments from the session are never logged to `_signals.log`.

---

## Findings

### Finding 1 — Hub section name/format mismatch renders read_hub and open_question blind at L3 (P0)

**Title:** `open_question` and `read_hub` use checkbox-list format; `boot-context.py` and `blank-template.md` use pipe-table format — they cannot interoperate

**Evidence:**
- `assets/blank-template.md` (lines ~55-60): canonical hub has `## Open Questions & Blockers` with a pipe table: `| # | Question / Blocker | Type | Owner | Status |`
- `hooks/lib/boot-context.py:207`: `parse_hub` regex matches `## Open Questions & Blockers\s*\n\|[^\n]*\n\|[-| ]+\n` — expects the table format
- `mcp-servers/cortex-vault/tools/open-question.js:33`: `sectionHeader = '## Open Questions'` — wrong section name, writes checkbox items
- `mcp-servers/cortex-vault/tools/read-hub.js:45`: `extractSection(body, 'Open Questions')` and `extractSection(body, 'Blockers')` — both wrong section names, both return empty for template-scaffolded hubs
- `mcp-servers/cortex-vault/tests/fixtures/vault/.../Test Project — Project Context.md`: the test fixture uses checkbox format (not the template's table format), masking the mismatch in tests

**Impact:** At L3 (the data scientist's primary mode), `cortex-check-status` always reports zero open questions/blockers for hubs scaffolded from the canonical template. The `open_question` tool silently creates a second, orphaned `## Open Questions` checkbox section instead of updating the table. Boot-context.py correctly reads the table at session start but `read_hub` cannot — so the status check during a session is wrong even though the boot block was correct. Blockers are invisible mid-session.

**Suggested fix:** Align all three to one format. The table format (in `blank-template.md` and `boot-context.py`) is the richer schema — it includes Type, Owner, and Status columns. Update `open-question.js` and `read-hub.js` to parse and write the table format. Alternatively, unify on checkbox lists and update `boot-context.py`'s `parse_hub` regex and `blank-template.md`. Update the test fixture to match whichever format is canonical.

---

### Finding 2 — Git worktree paths are never in the registry, silently drop from L3 to L1 (P1)

**Title:** `git worktree add` paths are not added to `repo_paths`, causing L1 sessions in what the user considers the same project

**Evidence:**
- `hooks/lib/boot-context.py:121-154` (`resolve_cwd`): walks up from `cwd_real` comparing against `project.get("repo_paths", [])` — exact path match only, no git worktree resolution
- `mcp-servers/cortex-vault/lib/registry.js:116-126` (`findProjectByCwd`): same walk-up, same exact-match logic
- `mcp-servers/cortex-vault/tools/register-repo.js` (not read, but by absence): no evidence of git-level worktree introspection
- Hypothesis: no code reads `.git/worktrees/` or calls `git rev-parse --git-common-dir` to resolve a linked worktree back to its main repo

**Impact:** Data scientists routinely use git worktrees to experiment on branches without losing their main working tree. Opening Claude Code in a worktree silently drops to L1 — no project context, no blocker awareness, no ambient capture routing. The user doesn't know this happened because L1 is silent (correct behavior for L1, but wrong activation level).

**Suggested fix:** In `boot-context.py`'s `resolve_cwd`, after exact-path match fails, check if `<candidate>/.git` is a file (not a directory) — that indicates a linked worktree. If so, read the file, extract the `gitdir` path, resolve to the common dir, and re-walk from the main worktree root against `repo_paths`. Alternatively, auto-register worktree paths alongside the main repo when `cortex-register-repo` is called (or suggest registration at first-use of an unregistered worktree).

---

### Finding 3 — `recent_decisions` at boot surfaces Changelog.md footer boilerplate instead of actual decisions (P1)

**Title:** `parse_hub` reads the last 5 non-empty lines of `Changelog.md` verbatim, which often includes the `---` separator and `*Related:* [[_MOC]]` wiki-link footer

**Evidence:**
- `hooks/lib/boot-context.py:232-234`:
  ```python
  lines = [l.strip() for l in f.readlines() if l.strip()]
  result["recent_decisions"] = lines[-5:]
  ```
  Strips blank lines but keeps all other content, including YAML frontmatter footer-separators and `*Related:*` lines.
- `mcp-servers/cortex-vault/tests/fixtures/vault/.../Changelog.md` (last 5 non-empty lines): `- 2026-04-02: Added tech stack`, `- 2026-04-05: Client check-in, discussed API integration`, `---`, `*Related:* [[_MOC]] · [[Test Project — Project Context]]` — two of the five lines are structural noise
- `hooks/session-start:79`: these lines are joined with `'; '` and surface in the L3 boot block as `Recent decisions: - 2026-04-05: ...; ---; *Related:* [[_MOC]] · ...`

**Impact:** The L3 opening message ("Ready. 2 open blockers. Recent decisions: ...") shows raw markup noise alongside actual decisions. For a data scientist who logs many "we decided X > Y" entries, the boot block shows Markdown syntax as if it were a decision. Confusing and undermines confidence in the system.

**Suggested fix:** In `parse_hub`, filter `recent_decisions` to only lines that start with known Changelog entry prefixes (e.g. `- `, `*`, or a date pattern like `\d{4}-`). Add a negative filter: `if line.startswith('---') or line.startswith('*Related:') or line.startswith('*Project:'): continue`. Alternatively, add a dedicated `## Recent Decisions` section to `Changelog.md` and parse that section instead.

---

### Finding 4 — Teaching-moment signals are detected but never written to `pending-signals.json`, so `_signals.log` stays empty without explicit `/cortex-coach` invocation (P1)

**Title:** The stop hook has full infrastructure to flush `pending-signals.json` to `_signals.log`, but no code path writes that file during normal sessions

**Evidence:**
- `hooks/user-prompt-submit:172-178`: when "explain", "why does", "how does", etc. are detected, sets `TEACHING_HINT` and outputs a `<cortex-hint type="teaching-moment">` to the conversation context — but **does not write `pending-signals.json`**
- `hooks/stop:51-97`: checks for `pending-signals.json`, reads it, and writes to `_signals.log` — but only if the file exists
- Search across all `.js`, `.py`, and shell files in the repo for `pending-signals` found zero write-side callers outside the `stop` hook itself and a `docs/` plan file
- `skills/cortex-coach/SKILL.md:46`: "The UserPromptSubmit hook tags teaching-moment exchanges for the Stop hook" — but the mechanism (the hook writing the JSON file) is not implemented; the hint is only injected into the conversation context and cannot survive into the stop hook's filesystem check

**Impact:** For a data scientist asking Claude to explain why a regularization technique works, or to walk through gradient boosting math, those teaching moments are tagged in the conversation but never logged. The `cortex-coach` skill's growth analysis ("you've asked about XGBoost 5 times") has no signal to draw from unless the user explicitly invokes `/cortex-coach`. The longitudinal learning feedback loop is silently broken.

**Suggested fix:** In `user-prompt-submit`, when a teaching moment is detected, write a JSON entry to `$PLUGIN_DATA/session-cache/pending-signals.json` (append-safe: read array if exists, push new entry, write back). The domain and topic should be inferred from the prompt text at hook time (a heuristic — even a generic entry with `domain:unknown` is better than nothing). The stop hook infrastructure is already correct and will flush it automatically.

---

### Finding 5 — Tier 1 ambient capture fires inside L3 (read-only) sessions without gating, violating the L3 read-only default (P1)

**Title:** `capture-rules.md` says "Tier 1 never asks permission" but `activation-levels.md` says L3 is "read-only by default" — these policies directly contradict each other, and the model receives both

**Evidence:**
- `references/capture-rules.md:33`: "**Tier 1 never asks permission.** If the conversation contains one of these signals and the destination is obvious, write it."
- `references/activation-levels.md:50-51`: "**Default: read-only against the vault.** Explicit user confirmation is required before writing from a repo-context session. [...] Exception to read-only: when the user uses an explicit trigger phrase ('log this', 'we decided', etc.)"
- `references/activation-levels.md:51` defines exceptions only for explicit triggers, but Tier 1 ambient capture explicitly fires on inferred signals ("user makes a scope, strategy, or direction decision" — no trigger phrase required)
- Both files are loaded by `cortex-boot` and both are in scope simultaneously

**Impact:** Inside a git repo (the data scientist's normal L3 context), Cortex may silently write to the vault when the user says "yeah, we're going with XGBoost for now" mid-conversation — even if the user intended it as exploratory thinking, not a logged decision. The data scientist may not notice the one-line confirmation buried in a long session. Alternatively, the model may correctly honor L3 read-only and NOT capture — leading to missed decisions that the user expected would be captured because they used a "we decided" phrase. Either way, one of the two policies is violated.

**Suggested fix:** Add a reconciliation note to both files. The canonical rule should be: in L3, the explicit trigger phrases ("log that", "we decided", etc.) from `capture-rules.md` override the read-only default — but ambient Tier 1 inferred capture (no trigger phrase) requires a one-line confirmation before writing, even at Tier 1. This third posture ("Tier 1 but confirm at L3") resolves the contradiction without breaking the user expectation in either direction.

---

### Finding 6 — recall_related score threshold is enforced in SKILL.md prose only; the MCP tool returns all results to the model regardless of score (P2)

**Title:** `recall_related.js` returns results with scores below 0.5 to the model; the threshold is prose guidance the model may or may not apply

**Evidence:**
- `mcp-servers/cortex-vault/tools/recall-related.js:80-87`: maps results to `{path, title, score, why}` with `score = 1 - distance/2` — no filtering by score threshold
- `skills/cortex-boot/SKILL.md:85`: "Only surface results that have `score > 0.5`. Everything below that is noise." — this is a prose instruction to the model, not a code filter
- The tool description (`recall-related.js:101`) says "proactively" but does not mention a score threshold

**Impact:** For a data scientist whose vault has many notes, recall_related may return 5 low-relevance notes (e.g. old meeting notes that share a term like "model" or "pipeline") with scores of 0.3. The model may surface one of those as "Worth knowing: you documented this in [[2025-08-15 Team Standup]]" — which is wrong and erodes trust in the ambient recall feature. The 0.5 threshold guidance in SKILL.md is easy to miss or ignore, especially in long sessions.

**Suggested fix:** Add a `min_score` parameter to `recall_related` (default 0.5). In the tool handler, filter `results` to `score >= min_score` before returning. Keep the default at 0.5 to match the SKILL.md guidance. This makes the quality gate enforceable and consistent regardless of model behavior. The prose guidance in SKILL.md can be retained as a "do not surface even at 0.5 if the relevance isn't clear from the `why` terms" qualitative note.

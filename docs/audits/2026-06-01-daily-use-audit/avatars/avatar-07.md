---
avatar: "07"
persona: "Academic Researcher"
surface: "Claude Desktop"
audit_date: "2026-06-01"
vault_scale: "12k notes, citation-heavy, cross-project literature links"
---

# Avatar 07 — Daily-Use Audit

## Persona

**Name:** Dr. Maya Chen (simulated)
**Role:** Academic researcher, 5+ active research projects, 12,000-note Obsidian vault
**Work style:** Citation-dense writing, cross-project literature links, recurring advisor/collaborator meetings, heavy Knowledge Base use for methodology notes and vendor/tool gotchas, frequent transcript processing from recorded seminars and interviews.
**Pain points:** Finding prior literature notes across projects, keeping research blockers visible, processing interview transcripts quickly, not losing methodological decisions mid-project.
**Daily rhythm:** Morning session (read, annotate, link); afternoon session (writing, Claude assistance); evening (meeting processing).

---

## Day-in-the-Life Narrative

Maya opens Claude Desktop at 8:45 AM from her home directory — not inside any registered repo. The session-start hook fires, boot-context.py reads config.json, resolves cwd to L1 (Passive), reads personality.md, caps memory.md at 100 lines, and injects the `<cortex-session>` block. cortex-boot fires silently. No opening message — correct L1 behavior.

**9:00 AM — Literature review session**
Maya asks: "I'm picking up the Chapter 3 lit review for the NSF climate study — what's the current state of things?" The trigger phrase "what's the status of" matches `cortex-check-status` via the user-prompt-submit hook. cortex-check-status reads the NSF project hub and Changelog. It surfaces stage, blockers, recent decisions. This works. She follows up: "the IRB approval came through — that blocker is resolved." Cortex routes to `cortex-update-context`. The skill calls `open_question` MCP tool with `action: resolve`. The MCP tool marks the item `- [x] IRB approval pending — Resolved: approved 2026-06-01`. Cortex announces the clearance. However, the row is **not removed** — it now sits as `- [x]` noise in the hub. Every future hub read will show it cluttering the Open Questions section. The SKILL.md spec and the workflow both explicitly say: remove the row entirely.

**10:30 AM — Cross-project recall during writing**
Maya is writing about methodology selection. She mentions "I'm thinking about using Grounded Theory for the interview analysis." cortex-boot's ambient recall fires `recall_related` with the request context. The tool queries the sqlite-vec database and returns 5 results — including a note from 2024 where she compared Grounded Theory vs. Thematic Analysis for a different project. Score: 0.63. Useful. But also included: a note with score 0.41 about a tangentially related topic. The tool returns ALL results (no score filtering); the model is supposed to suppress anything below 0.5 per the cortex-boot SKILL. In a well-behaved session, the model filters it correctly. But this is a behavioral rule enforced only by prompt instructions — there is no server-side guard. At 12k notes, the 0.5 threshold is especially important; low-score noise increases with vault size because there are more mediocre near-matches.

**11:15 AM — Pasting citation metadata**
Maya pastes a 25-line bibliography export from Zotero to get help formatting it for her paper. The block looks like:

```
Author: Smith, J.
Title: Climate Adaptation in Coastal Systems
DOI: 10.1234/cas.2024
Year: 2024
Journal: Nature Climate Change
...
```

Twenty-five lines. `Author:`, `Title:`, `DOI:`, `Year:` each match the transcript detection regex `^[A-Za-z]+: `. With SPEAKER_COUNT >= 3 and LINE_COUNT >= 20, the user-prompt-submit hook injects `cortex-hint: likely-skill: cortex-process-meeting`. The model sees this hint and fires `cortex-process-meeting` against a citation block — treating it as a meeting transcript. This either fails gracefully (model can tell it's not a meeting) or generates a spurious "which project does this meeting belong to?" prompt. Either way it's an interruption to the expected citation-formatting flow.

**12:00 PM — Knowledge Base extraction**
During the writing session, Claude surfaces a useful methodology note: Grounded Theory requires theoretical saturation across 12-25 interviews at this field-site scale. Maya says "worth remembering — that saturation range applies to any qualitative study I do." Cortex correctly routes to `cortex-knowledge`. The skill checks `Knowledge Base/_MOC.md`, finds no existing article, and creates one. It attempts to apply `#domain/<relevant>` tagging. The available domain values are: `shopify`, `wordpress`, `frontend`, `backend`, `design`, `devops`, `seo`. None apply to qualitative research methodology. Cortex will either apply a wrong tag or emit no domain tag, leaving the article unclassifiable in the taxonomy.

**2:30 PM — Advisor meeting transcript**
Maya pastes a 180-line Granola transcript from her weekly advisor meeting. The structural trigger fires correctly: LINE_COUNT >= 20, SPEAKER_COUNT >= 3 (legitimate speaker labels this time). `cortex-process-meeting` fires. It detects the "Advisor Weekly" title and correctly attempts threading. The `thread_meeting` MCP tool checks how many prior instances exist in the Notes folder: 2 (this would be the third). However — the tool requires `effectiveGroup.length >= 3` to thread. The new file is not yet on disk when `thread_meeting` is called. The tool adds the new meeting to the effective group only if `alreadyInGroup` is false, making the count 3. Threading proceeds. This part works. But if the file **was** already written to disk before `thread_meeting` is called (the more natural order), it IS in the group and counts as instance 3 already — threading still works. The threading logic handles both orderings correctly.

**3:30 PM — Status check from outside repo**
Maya opens a new Claude session from `~/Documents/Research/` — not inside the vault, not a registered repo. Boot computes L1. She asks: "what's the status of the NSF climate study?" The hook injects `cortex-check-status` hint. The skill fires, reads the hub, returns status. Works as expected for L1 with explicit query.

**4:00 PM — L3 session from a registered research repo**
Maya opens Claude from `~/Documents/Research/nsf-climate-analysis/` — a registered repo. Boot walks up cwd, matches the registry entry, sets activation level 3. `parse_hub` is called against the NSF project hub. The hub was created by `scaffold_project` (which Maya used when setting up the project months ago). Scaffold creates:
- `## Open Questions` (simple section with `- [ ]` checkboxes)
- `## Blockers` (separate simple section)

But `parse_hub` in boot-context.py uses a regex looking for `## Open Questions & Blockers` with a pipe-table format: `\|[^\n]*\n\|[-| ]+\n`. This regex matches zero rows in the scaffolded hub. The L3 session block reports `Blockers: (empty)` — even though the hub contains active blockers. The opening line becomes: "NSF Climate Study — Data Collection stage. 0 open blockers. Ready." This is silent wrong information at session start, at the most important moment of the day.

**End of day — Memory flush**
Maya's session ends. The Stop hook fires, reads `pending-memory.json`, appends updates to `memory.md`, logs to `_changelog.txt`. This works correctly.

---

## Findings

### Finding 1 — Scaffold creates wrong hub format; boot-context never sees blockers at L3

**Area:** boot
**Severity:** P0

**Evidence:**
- `mcp-servers/cortex-vault/tools/scaffold-project.js:180-182`: scaffold creates `## Open Questions\n\n\n` and `## Blockers\n\n\n` as separate plain sections.
- `hooks/lib/boot-context.py:207`: `parse_hub` regex: `r'## Open Questions & Blockers\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)'` — requires a combined section heading AND pipe-table rows.
- `assets/blank-template.md:70-73`: The blank template uses the table format correctly. Scaffold does not match it.

**Impact:** Any project created via `scaffold_project` (the normal path for new projects) will show zero blockers in the L3 session opening line, every session. A researcher with 5 active projects and multiple open blockers per project sees `0 open blockers` at boot — the core L3 value proposition is silently broken. The failure is invisible; there is no warning.

**Suggested fix:** Align `scaffold-project.js` hub template with `blank-template.md`: use `## Open Questions & Blockers` as a single combined section with a pipe table (`| # | Question/Blocker | Type | Owner | Status |`). Alternatively, update `parse_hub` to also parse the two separate checkpoint sections, but changing the canonical format to match the template is cleaner.

---

### Finding 2 — `open_question` resolve uses `[x]` strikethrough instead of removing the row

**Area:** capture
**Severity:** P1

**Evidence:**
- `mcp-servers/cortex-vault/tools/open-question.js:77`: `lines[matchIdx] = \`- [x] ${originalText} — Resolved: ${resolution}\``; — writes `[x]` in-place.
- `skills/cortex-update-context/SKILL.md` (Blocker-Resolved Rule): "Remove the row from the Hub's Open Questions table entirely. Do not use strikethrough."
- `workflows/update-context.md:66`: "**REMOVE** the row from the hub's Open Questions & Blockers table entirely — do not use strikethrough."

**Impact:** Every resolved blocker stays in the Open Questions section as a `[x]` checked item. Over time (weeks/months), the hub accumulates dozens of struck-through items. Status checks surface noisy, cluttered output. For an academic tracking IRB approvals, ethics reviews, data access blockers across 5 projects, this becomes a serious signal-to-noise problem. `read_hub.js` does filter out `[x]` items (it only matches `^- \[ \]`), but `boot-context.py`'s `parse_hub` uses the table format anyway, so there's no consistent handling.

**Suggested fix:** In `resolveQuestionInBody`, remove the matched line entirely (`lines.splice(matchIdx, 1)`) rather than rewriting it with `[x]`. Log the original text and resolution date in the Changelog via `append_changelog` (which the handler does not currently call on its own — callers must do it separately).

---

### Finding 3 — Transcript detection regex fires on citation/bibliography pastes (false positive)

**Area:** capture
**Severity:** P1

**Evidence:**
- `hooks/user-prompt-submit:63`: `grep -cE '^[A-Za-z]+: '` — any line starting with a capitalized word followed by `: ` counts as a speaker label.
- A Zotero BibTeX/RIS export, a structured abstract, a metadata block (`Author: ...`, `Title: ...`, `DOI: ...`, `Year: ...`, `Journal: ...`) satisfies both the `LINE_COUNT >= 20` and `SPEAKER_COUNT >= 3` conditions.
- This injects `cortex-hint: likely-skill: cortex-process-meeting | confidence: high` for citation pastes.

**Impact:** An academic researcher pastes literature notes, bibliography exports, or structured metadata frequently (multiple times per session). Each paste gets routed toward `cortex-process-meeting`, causing either a spurious "which project is this meeting for?" interruption or a confusing failed filing attempt. At confidence "high", the model is strongly biased toward acting on the hint.

**Suggested fix:** Add a negative discriminator to the structural transcript check: require that speaker-label lines form at least 25-30% of all lines (dense dialogue), or require speaker names to be more than one word (e.g., `[A-Z][a-z]+ [A-Z][a-z]+: ` for proper names vs. single-word metadata keys). Alternatively, exclude common metadata keys from the speaker-label count: `Author`, `Title`, `DOI`, `Year`, `Journal`, `Publisher`, `Volume`, `Issue`, `Pages`, `URL`, `Abstract`.

---

### Finding 4 — `recall_related` returns all scores; the 0.5 threshold is prompt-only and unenforced

**Area:** recall
**Severity:** P2

**Evidence:**
- `mcp-servers/cortex-vault/tools/recall-related.js:79-84`: results filtered only by `exclude_paths`, not by score. All k results are returned regardless of `score` value.
- `skills/cortex-boot/SKILL.md:86`: "Only surface results that have `score > 0.5`. Everything below that is noise."
- The 0.5 rule is an instruction to the model, not a server-side filter. The tool JSON will include low-score results; the model must choose to suppress them.

**Impact:** In a 12k-note vault, semantic search produces more mediocre near-matches across thousands of loosely related notes. Low-confidence recalls (score 0.3–0.49) will appear in the tool output on nearly every turn. The model sometimes surfaces these anyway (it mis-reads the score, or the instructions drift across long sessions). For a researcher, spurious "Worth knowing: you documented X in [[Note Y]]" that is actually unrelated creates trust erosion with the ambient recall feature.

**Suggested fix:** Add a `min_score` parameter to `recall_related` with default `0.5`. Apply `WHERE` or post-filter: `results.filter(r => r.score >= min_score)`. This enforces the threshold server-side, making the behavior consistent regardless of model instruction drift. The cortex-boot SKILL can pass `min_score: 0.5` explicitly.

---

### Finding 5 — `check_dormant_features` is hardcoded to `weekly_review` only; all other dormant features are invisible

**Area:** boot
**Severity:** P2

**Evidence:**
- `hooks/lib/boot-context.py:367-378`: `check_dormant_features` only checks for `"weekly_review"` in the dormant list. It returns a suggestion for `weekly_review` if `changelog_total >= 50` and the string `weekly_review` appears in the dormant YAML.
- `references/progressive-features.md` defines 8 additional dormant features: `meeting_threading`, `daily_briefing`, `knowledge_extraction`, `project_health`, `content_drafting`, `goal_tracking`, `email_triage`, `task_sync`.
- None of these have activation signals checked in `boot-context.py`.

**Impact:** An academic researcher with 50+ changelog entries will only ever be offered `weekly_review`. `daily_briefing` (valuable for someone with 5 research projects and many blockers), `meeting_threading` (extremely relevant given weekly advisor meetings), and `knowledge_extraction` (relevant to their heavy KB use) are never surfaced. The progressive-features system is effectively a stub. The `mcp-servers/cortex-vault/tools/check-dormant-features.js` exists as a separate MCP tool, but `boot-context.py` does not call it and implements its own stub instead.

**Suggested fix:** Either call `check-dormant-features.js` from the session-start hook (an MCP call is too slow for a boot hook), or expand `check_dormant_features` in `boot-context.py` to evaluate the activation signals for all dormant features declared in `personality.md`, not just check for the `weekly_review` string. The signal types (`count`, `elapsed`, `ratio`) are all cheap to evaluate from `_changelog.txt` line counts and file-system stats.

---

### Finding 6 — Domain tag taxonomy is web-development-only; academic content is unclassifiable

**Area:** capture
**Severity:** P2

**Evidence:**
- `references/vault-conventions.md:25`: `#domain/` values: `shopify, wordpress, frontend, backend, design, devops, seo`. No research, methodology, theory, or domain-neutral values.
- `skills/cortex-knowledge/SKILL.md:186`: "it applies `#domain/<relevant>` based on the knowledge content, but the user can re-tag later."
- `mcp-servers/cortex-vault/tools/scaffold-project.js:172`: `domain` field is used during scaffolding; if the user passes no domain, the tag is omitted (valid). But when `cortex-knowledge` extracts methodology notes, it will attempt to apply a domain tag from the canonical list — none of which apply.

**Impact:** A researcher extracting patterns like "Grounded Theory saturation thresholds", "IRB amendment strategies", or "qualitative coding inter-rater reliability methods" into the Knowledge Base will see notes tagged with incorrect domains (e.g., `#domain/backend` for a methodology note) or left without domain tags. Filter/search by domain becomes useless for the researcher's actual knowledge corpus. As their Knowledge Base grows to hundreds of articles (common at 12k notes), the absence of meaningful domain taxonomy makes it harder to find related articles by faceted search.

**Suggested fix:** Extend the `#domain/` taxonomy with generic research-adjacent values: `research`, `methodology`, `writing`, `analysis`, `tools`. Alternatively, make domain a free-form field in `personality.md`'s `buckets` schema so each user can define their own domain values at onboarding. The `vault-conventions.md` currently hard-codes a list that only fits the web-development persona the plugin was built around.

---

## Summary Table

| # | Finding | Area | Severity |
|---|---------|------|----------|
| 1 | Scaffold hub format (checkbox sections) never matches boot-context parse_hub (table format) — L3 always shows 0 blockers | boot | P0 |
| 2 | `open_question` resolve writes `[x]` strikethrough instead of removing the row | capture | P1 |
| 3 | Transcript detection regex fires on citation/bibliography pastes | capture | P1 |
| 4 | `recall_related` returns all scores; 0.5 threshold is unenforced server-side | recall | P2 |
| 5 | `check_dormant_features` hardcoded to `weekly_review`; 8 other features never surface | boot | P2 |
| 6 | `#domain/` taxonomy is web-dev-only; academic content gets wrong or no domain tag | capture | P2 |

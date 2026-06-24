# Avatar 14 — Daily-Use Audit

**Date:** 2026-06-01
**Persona:** Grad student, low tech comfort, courses-as-projects, easily confused by jargon
**Surface:** Claude Desktop
**Avatar ID:** 14

---

## Persona Summary

Maya is a second-year graduate student using Cortex to manage her thesis chapters, course seminar papers, lab meeting notes, and advisor conversations as Obsidian vault projects. She has moderate Obsidian familiarity but low Claude Code fluency — she does not think in terms of hooks, skills, MCP servers, or activation levels. She has one vault with three "projects": her thesis, a seminar, and a lab rotation. She opens Claude Desktop 3–4 times per day: morning orientation, midday writing session, an occasional advisor meeting debrief, and an evening check-in. She does not use the terminal. She is on macOS.

---

## Simulated Day

**8:50 am — Morning check-in.** Maya opens Claude Desktop from a Finder window inside her thesis folder on the Desktop (`~/Desktop/Thesis/`). She types: "good morning, where did I leave off on my thesis?" Cortex has no registered repo for `~/Desktop/Thesis/` — `resolve_cwd` walks up from `~/Desktop/Thesis/` to `~/Desktop/` and hits the `home` directory stop guard before reaching any registered path. Activation lands at **L1 — Passive**. The `<cortex-session>` block shows no project data. Cortex greets her as a generic assistant. Maya is confused: she thought Cortex "knew about her projects."

**9:15 am — Seminar paper work.** She pastes a paragraph she wrote last night and asks Claude to help tighten it. Mid-conversation she says: "yeah I'm going to go with the Foucault framing for the whole paper." The `user-prompt-submit` hook fires and correctly matches `*"going to go with"*` as a decision trigger, routing to `cortex-update-context`. But Cortex fires the skill and immediately asks: *"Is this for [thesis], [seminar], or another project?"* — the project is genuinely ambiguous at L1 because the vault's `personality.md` has all three projects. Maya has no idea what the question means in this context. She types "seminar" and the skill proceeds — but then it cannot find the project hub because the seminar folder path was never registered as a repo. The skill surfaces: "I don't see a project called 'seminar' in your vault." Maya gives up and moves on.

**11:30 am — Advisor meeting debrief.** After a Zoom with her advisor, Maya opens Claude Desktop (still in `~/Desktop/Thesis/`). She types: "here are the notes from my meeting with Prof. Chen." The `user-prompt-submit` hook matches `*"here are the notes from"*` and injects a `cortex-process-meeting` hint. Good. She pastes ~25 lines of rough notes without speaker labels. The structural transcript detector checks for `LINE_COUNT >= 20` AND `SPEAKER_COUNT >= 3` matching `^[A-Za-z]+: ` — her notes have no speaker labels, so structural detection does not fire. The explicit phrase matched by `3b` does fire. Processing begins. The skill needs to know which project the meeting belongs to. It asks. Maya says "thesis." Cortex looks for a `Notes/` folder under the thesis project — but the project was never scaffolded in the vault, so the destination path doesn't exist. The skill correctly surfaces a failure mode message, but the message uses the word "scaffold" — a term Maya does not know.

**2:00 pm — Status check.** She types "what's left on my thesis?" The `user-prompt-submit` hook matches `*"what's left on"*` and routes to `cortex-check-status`. The skill fuzzy-matches "thesis" to a project in `personality.md` (if one exists there), reads the hub file — but the hub doesn't exist yet because Maya never completed onboarding for that project. The skill surfaces: "Thesis folder exists but the Project Context hub is missing. Want me to scaffold the missing hub from the template?" Again "scaffold." Maya reads this as a technical error message and types "yes" without understanding what she agreed to.

**4:30 pm — Wrapping up.** She types "that's resolved" after telling Claude a blocker was cleared. The hook fires a `cortex-update-context` hint. The skill activates. It tries to find the open blocker in the project's Open Questions table — but the hub was just scaffolded from template with empty tables. Nothing is found. The skill surfaces: "I don't see that blocker in Thesis's Open Questions. Should I add the resolution to the Changelog only, or is this a blocker from a different project?" Maya doesn't know what a Changelog is. She closes Claude.

**Evening — Semantic recall.** During the afternoon session, when Maya asked about formatting academic citations, Cortex called `recall_related` as specified by `cortex-boot` Step 6. The embedding model (`Xenova/all-MiniLM-L6-v2`) ran inference on first use — this has a cold-start latency of 2–5 seconds the first time in a session while the transformer pipeline loads. Maya saw no response for several seconds with no visible indicator. She assumed Claude froze.

---

## Findings

### Finding 1 — L3 never activates for users who keep projects on the Desktop or in non-registered locations (P1)

**Area:** activation  
**Evidence:** `hooks/lib/boot-context.py:136–149`. `resolve_cwd` walks up from cwd but stops at `os.path.expanduser("~")`. A project at `~/Desktop/Thesis/` stops the walk at `~/Desktop/` (parent of `~/Desktop/Thesis/`) — which equals `home` — so the loop breaks before checking `~/Desktop/Thesis/` itself as a registry entry. Wait: re-reading lines 140–148: the loop checks `candidate` first, then computes `parent`, then breaks if `candidate == home`. So `~/Desktop/Thesis/` IS checked before the break. But if the path was never registered as a `repo_path` in `registry.json`, it still returns L1. The real issue is that **grad students never register their project folders as repos** — they just have folders. The onboarding flow does not automatically register vault-internal project folders as repos, and nothing in the daily loop prompts them to do so. Result: every session is L1 for this persona.

**Impact:** The entire value of L3 (project briefing, proactive blockers, ambient capture) is invisible to this user class. They experience Cortex as a slightly-aware generic assistant.

**Suggested fix:** At L1 boot, if `active_projects` are found in `personality.md` and the cwd is _inside the vault_, auto-escalate to L2 rather than L1. Add a one-time prompt after the first L1 session: "I see you have projects in your vault but I'm not sure which one you're working on — say 'I'm working on [project]' to give me context." This costs nothing and recovers the activation gap without requiring repo registration.

---

### Finding 2 — Technical jargon ("scaffold", "Project Context hub", "Changelog") surfaces to low-tech users with no explanation (P1)

**Area:** ux  
**Evidence:** `skills/cortex-check-status/SKILL.md:133–134` (failure mode: "scaffold the missing hub from the template"), `skills/cortex-update-context/SKILL.md:207` ("scaffold it from the template"), `skills/cortex-process-meeting/SKILL.md:204` ("hand off to cortex-ingest-project"). These exact strings surface verbatim to the user.

**Impact:** Grad student persona has no frame of reference for "scaffold", "hub", "Changelog" as Cortex-specific nouns. These words read as technical errors or developer jargon, causing users to misread them as system failures or to approve actions they don't understand ("Want me to scaffold the missing hub?" → user types "yes" without knowing they're agreeing to create a project structure).

**Suggested fix:** Rewrite failure mode messages to use plain language. Examples:
- "scaffold the missing hub" → "set up a project file for Thesis"
- "Project Context hub" → "your Thesis project file"
- "the Changelog" → "a log of changes"

Keep the technical names in internal skill docs; translate at the user-facing string boundary.

---

### Finding 3 — Ambient Tier 1 decision capture fires the write skill at L1 with no project context, producing a disorienting disambiguation question (P1)

**Area:** capture  
**Evidence:** `references/capture-rules.md:33` ("Tier 1 never asks permission"). `references/activation-levels.md:16–18` (at L1, capture "watches" but does not write without clear user intent). There is a contradiction: `capture-rules.md` says Tier 1 fires without asking at L1, but `activation-levels.md` line 17 says "Cortex never writes to the vault without clear user intent at this level." When `cortex-update-context` fires at L1 with no project in context, it must ask "which project?" — but the skill's disambiguation question ("Is this for [A], [B], or both?") is asked in a flat list with project internal IDs or vault bucket names, not human-readable descriptions.

**Impact:** At L1, the capture interrupt is unexpected (no boot message established vault context), the disambiguation question uses names the user may not recognize as their own projects, and the experience feels like the assistant "broke conversation" without explanation.

**Suggested fix:** At L1, when a Tier 1 trigger fires, preface the disambiguation question with one sentence of context: "I can log that to your vault — which project should I add it to?" followed by human-readable project names (not IDs). Also, respect the `activation-levels.md` L1 contract: at L1, ask before writing (Tier 2 behavior), don't silently fire Tier 1 writes.

---

### Finding 4 — Semantic recall cold-start latency is invisible to the user (P2)

**Area:** perf  
**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js:7–16`. `getExtractor()` lazily initializes the `@huggingface/transformers` pipeline on first call with `pipeline('feature-extraction', MODEL_ID)`. This is a cold-start that can take 2–5 seconds on first call per session while the model loads into memory. `cortex-boot` Step 6 (`skills/cortex-boot/SKILL.md:71–88`) instructs Claude to call `recall_related` silently at the start of substantive tasks. There is no spinner, no "thinking" indicator, and no mention to the user that a background operation is running.

**Impact:** From the user's perspective, Claude stopped responding for several seconds with no feedback. On slow machines or with a cold model cache, this can exceed 5 seconds. A low-tech user interprets this as a freeze or error.

**Suggested fix:** Two options: (1) Warm the embedding pipeline at session-start in the background (fire-and-forget MCP call with a dummy embed after boot completes), so the first real `recall_related` call hits a warm cache. (2) Add a one-line "checking your notes..." indicator to `cortex-boot` Step 6's surfacing rule when recall is triggered. Option 1 is better for UX because it's invisible when working.

---

### Finding 5 — Meeting notes without speaker labels bypass structural detection but explicit-phrase routing still fires — the two paths produce inconsistent behavior (P2)

**Area:** meeting  
**Evidence:** `hooks/user-prompt-submit:60–68` (structural detection requires `SPEAKER_COUNT >= 3` matching `^[A-Za-z]+: `). `hooks/user-prompt-submit:73–79` (explicit phrase detection matches "here are the notes from"). Grad students writing rough meeting notes rarely use `Name: text` speaker-label format — they write flowing prose notes. Structural detection misses these. Explicit phrase detection catches them if the user happens to phrase it right.

The inconsistency: structural detection injects `confidence: "high"` and immediately routes. Explicit phrase detection also injects `confidence: "high"`. But when neither fires — e.g., the user pastes notes without the "here are the notes from" phrase and without speaker labels — no hint is injected, and `cortex-boot` must infer the intent. The user gets no routing at all and the notes may be lost entirely.

**Impact:** Grad students who paste rough prose notes from a 1-on-1 advisor meeting (the most common meeting type for this persona) get inconsistent routing depending on whether they include the magic phrase. No phrase, no labels → no capture.

**Suggested fix:** Add a third structural path in `user-prompt-submit` that matches long pastes (20+ lines) containing a date reference and at least one of: "discussed", "agreed", "decided", "action", "follow up", "next steps", "advisor", "professor", "meeting" — weight these terms for meeting-note inference. Or, expand `cortex-boot` Step 6 ambient recall to flag meeting-like pastes (without requiring exact phrase or speaker format) and ask the user: "That looks like meeting notes — want me to file them?"

---

### Finding 6 — Stop hook flushes memory silently; memory.md grows unboundedly with no dedup or section structure (P2)

**Area:** capture  
**Evidence:** `hooks/stop:137–169`. The flush loop appends each `entry.get('content', '')` directly to `memory.md` with `f.write('\n' + content + '\n')` — no deduplication, no section headers, no max-length check beyond the boot-time 100-line cap in `read_memory()`. Over many sessions, the same facts (advisor name, thesis title, preferred citation style) accumulate as redundant appends. `boot-context.py:45–57` caps the read at 100 lines, so after ~50 sessions the oldest memory is silently dropped at boot even though it still exists on disk.

**Impact:** For a grad student who uses Cortex for a year, the memory file grows to hundreds of lines. The boot cap means early session preferences and advisor details are silently deprioritized after the file grows past 100 lines — but the user has no idea this is happening. They may notice Cortex "forgetting" things it previously knew.

**Suggested fix:** Add a simple merge pass in the stop-hook flush: before appending, check for any content that is a substring of existing memory lines and skip it. Also surface a `memory.md` line count in the session block when it exceeds 80 lines: "Memory note: your memory file has N entries — say 'clean up my memory' to prune it." This gives the user agency over the growing file rather than silent truncation.

---

## Summary

For a grad student persona, the hardest daily frictions are: (1) L3 never activates because academic project folders are rarely registered repos, collapsing the core value proposition; (2) every failure message uses developer vocabulary that is opaque to the user; (3) ambient Tier 1 capture at L1 surprises the user mid-conversation with disambiguation questions that feel like errors; (4) semantic recall cold-start makes the tool feel broken on first use. The meeting and memory findings are secondary but compound the frustration over weeks of use.

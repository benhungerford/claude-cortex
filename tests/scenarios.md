# Cortex — Test Scenarios (Stage 2, human-runnable)

## Purpose

This file is the behavioral spec for the 8 `cortex-*` skills in this plugin, expressed as 10 scripted, end-to-end scenarios. Every scenario is traceable to either a literal trigger phrase or a structural signal defined in `references/trigger-phrases.md`, and to the documented behavior in the relevant `SKILL.md`.

In Stage 2 these scenarios are **human-runnable**: a human reader sets up the pre-conditions, triggers the session, and manually verifies the expected behavior, mutations, and chat output. In Stage 4 these same scenarios will be converted into code-runnable tests (likely a harness that spins up a sandbox vault, fakes cwd, and snapshots the filesystem after each run).

## How to execute (Stage 2)

For each scenario:

1. **Set up pre-conditions.** Put the vault, config, and cwd into the exact state described. This may mean creating a temporary vault, deleting `~/.claude/cortex/config.json`, or standing up a fake repo.
2. **Open a new Claude Code session** with the specified cwd. Do not continue an existing session — every scenario assumes a cold session start so `cortex-boot` fires fresh.
3. **Send the user input verbatim.** Copy the exact phrase from the scenario (or simulate the structural signal — e.g., paste the transcript, run the Granola MCP tool).
4. **Verify the expected skill was routed to** by checking Cortex's chat output and the sequence of tool calls. The routing hook or skill-loader should pick up the trigger match.
5. **Verify the expected behavior** by reading the chat transcript and the file mutations.
6. **Verify expected vault mutations** by diffing the vault against its pre-state. No extra writes, no missing writes.
7. **Verify the expected chat output** matches the documented one-line summary (exact wording can vary, semantic content cannot).
8. **Exercise at least one listed failure mode** by altering the pre-conditions and re-running. The failure handling must match what the `SKILL.md` says.

A scenario passes only if all verifications pass. A scenario that produces the right chat output but the wrong mutations is a failure.

## Baseline vault state (assumed unless a scenario overrides it)

Unless a scenario explicitly says otherwise, assume:

- `~/.claude/cortex/config.json` exists with `vault_path` pointing at the user's vault (e.g. `~/Documents/The Vault`).
- `<vault>/personality.md` exists and is valid.
- `<vault>/memory.md` exists.
- `<vault>/_changelog.txt` exists and is writable.
- `<vault>/.claude/cortex/registry.json` exists with entries for the known active projects (FKT, Jumpstart SC, FOND, Bubl Shots, Apex Resolve, Cortex, The Workout App, benhungerford.com, YoungWilliams).
- The Stage 2 `cortex-boot` behavior fires on the first message of each session (not yet a SessionStart hook).
- Today's date is 2026-04-08.

Scenarios that need a non-baseline state will call it out in **Pre-conditions**.

---

## Scenario 1 — Cold start, no vault → `cortex-onboarding` hard route

**Trigger phrase(s) or structural signal:** Structural. Session start with `~/.claude/cortex/config.json` missing. Row 1 of the routing table.

**Pre-conditions:**
- `~/.claude/cortex/config.json` is **deleted or renamed** (simulating a fresh install).
- cwd is `~/Downloads` (somewhere neutral, no vault, no repo).
- No vault exists at the default path.

**User input:** `hey`

**Expected skill routed to:** `cortex-onboarding` (via hard handoff from `cortex-boot` step 1).

**Expected behavior:**
- `cortex-boot` runs, reads (or fails to read) `~/.claude/cortex/config.json`, detects the file is missing, and hands off to `cortex-onboarding` with `reason="no config"`.
- `cortex-boot` produces no other visible output.
- `cortex-onboarding` opens with the warm intro sentence ("This is Cortex — a system that turns Claude and Obsidian into your second brain...") and asks the first discovery question.
- It does NOT proceed to Step 5 (The Build) without the user answering the discovery questions — only the first turn is in scope for this test.

**Expected vault mutations:** **None.** Onboarding does not write any files until Step 5. The first-turn hand-off only asks a question.

**Expected chat output (one line or short summary):** Warm intro sentence followed by the first discovery question (detect platform / start Obsidian setup or first discovery question per `workflows/onboarding.md`). No mention of "skill", "setup wizard", or "onboarding flow".

**Failure modes to verify:**
- **Config directory unwritable:** set `~/.claude/cortex/` to mode `0555` (read-only) before launching. The skill must surface the exact permission error (e.g. `mkdir ~/.claude/cortex && chmod u+w ~/.claude/cortex`) and stop — it must NOT proceed past Step 5.0.
- **User says "onboard me" but config already exists:** delete this failure and re-run with config intact and the literal trigger "I want to redo my Cortex setup." — the skill must present the 3-option redo menu (Fully redo / Regenerate personality / Cancel), defaulting to option 2.

---

## Scenario 2 — L1 passive session, unrelated question → `cortex-boot` silent, no writes

**Trigger phrase(s) or structural signal:** Structural. Session start, vault present, cwd unregistered, no orphaned stub. Row 4 of the routing table.

**Pre-conditions:**
- Baseline vault state.
- cwd is `~/scratch/python-experiments` (a real folder NOT in the registry and without any `CLAUDE.md` walking up).
- No orphaned Cortex stub anywhere in the walk-up path.

**User input:** `how do I reverse a list in Python?`

**Expected skill routed to:** `cortex-boot` only. No task skill fires. `cortex-boot` sets activation level to **L1 (Passive)**.

**Expected behavior:**
- `cortex-boot` reads config, `personality.md`, `memory.md`, and the last 50 lines of `_changelog.txt` silently.
- `workflows/resolve-cwd.md` returns `{status: "unregistered"}`.
- Activation level is L1.
- Capture rules are loaded into working memory for the remainder of the session.
- `cortex-boot` surfaces **nothing** about the vault.
- Claude answers the Python question directly (e.g., `list[::-1]` or `reversed(list)`), like any normal Claude Code session without Cortex. The response must not contain any opening line about a project, blockers, or vault state.

**Expected vault mutations:** **None.** L1 boot is read-only. `_changelog.txt` is NOT written because nothing changed.

**Expected chat output (one line or short summary):** A direct answer to the Python question. Zero Cortex chatter. No "heads up", no "FKT Shopify Website Build...", no project-context preamble.

**Failure modes to verify:**
- **`memory.md` missing:** boot must proceed without it (not create it — only onboarding creates initial `memory.md`). Still L1. Still silent.
- **`_changelog.txt` is 15 MB:** boot must use tail semantics, reading only the last 50 lines. Verify this doesn't measurably slow the first response.

---

## Scenario 3 — L3 session start in a registered repo → boot + resolve-cwd + opening line with blockers

**Trigger phrase(s) or structural signal:** Structural. Session start, cwd matches a registered repo in `registry.json`. Rows 4 and 19 of the routing table (cortex-boot step 4 → internal handoff to cortex-register-repo's resolve-cwd sub-operation).

**Pre-conditions:**
- Baseline vault state.
- `<vault>/.claude/cortex/registry.json` contains an entry for FKT with `repo_paths` including `~/projects/fkt-checkout`.
- That directory exists on disk and contains a valid Cortex stub `CLAUDE.md`.
- The FKT hub (`Work/TBL/Frankl & Thomas/Shopify Website Build/Shopify Website Build — Project Context.md`) has at least 2 open blockers in the Open Questions table (e.g., "Stripe sandbox credentials" and "Sage integration").
- cwd for the Claude Code session is `~/projects/fkt-checkout`.

**User input:** `morning, let's pick up where we left off`

**Expected skill routed to:** `cortex-boot` → internal handoff to `cortex-register-repo` (resolve-cwd sub-operation, read-only). Activation level is escalated to **L3 (Full Project)**.

**Expected behavior:**
- `cortex-boot` steps 1–3 complete silently.
- Step 4 calls `workflows/resolve-cwd.md`, which walks up from cwd, matches the FKT entry in the registry, and returns `{match: <FKT project>}`.
- Boot reads the FKT Project Context hub and loads open blockers into session memory.
- One opening line is emitted containing: project name, current stage, open blocker count, and a brief hint at what the blockers are.
- No dormant-feature suggestion fires during boot (per Step 5: max one queued, offered at the next natural pause).

**Expected vault mutations:** **None.** Boot and resolve-cwd are read-only in the match branch.

**Expected chat output (one line or short summary):** One line in the form `FKT Shopify Website Build — Integrations stage, 2 open blockers: Stripe sandbox credentials and Sage integration. Ready.` (exact stage/wording depends on current hub state).

**Failure modes to verify:**
- **Registry entry exists but the project's vault_path is missing/moved:** boot must surface a loud error — "Registry entry for FKT points at `<path>` but that folder doesn't exist..." — not silently fall back to L1.
- **`registry.json` is corrupted JSON:** boot must treat resolve-cwd as errored, surface a one-line warning (`Project registry unreadable — running in Passive mode.`), and run in L1 without crashing.

---

## Scenario 4 — "what's the status of FKT" → `cortex-check-status` with file citations

**Trigger phrase(s) or structural signal:** Literal: `what's the status of <X>`. Row 5 of the routing table.

**Pre-conditions:**
- Baseline vault state.
- cwd is anywhere inside the vault (L2) OR in the FKT repo (L3). Either works for this scenario.
- FKT hub exists with at least 2 open blockers; `Changelog.md` has at least 3 recent entries.
- Ben is NOT in a different project's repo — a clean fuzzy match to FKT.

**User input:** `what's the status of FKT?`

**Expected skill routed to:** `cortex-check-status`.

**Expected behavior:**
- Fuzzy match resolves "FKT" → `Frankl & Thomas / Shopify Website Build` (single unambiguous hit).
- Reads `Work/TBL/Frankl & Thomas/Shopify Website Build/Shopify Website Build — Project Context.md` AND `Work/TBL/Frankl & Thomas/Shopify Website Build/Changelog.md` (last 3 entries).
- Does NOT read any sub-notes (Tech Stack, Design System, etc.).
- Produces a 2–5 sentence summary including: current stage, open blocker count + what they are, last 2–3 decisions from the changelog.
- Ends with a `Sources:` line citing the Project Context hub and Changelog.
- Read-only. Never writes.

**Expected vault mutations:** **None.** `cortex-check-status` is strictly read-only, including for `_changelog.txt`.

**Expected chat output (one line or short summary):** Tight status summary of the form `FKT Shopify Website Build — Integrations stage. 2 open blockers: Stripe sandbox credentials (waiting on client) and Sage integration (architecture decision pending). Recent: moved checkout to Rebuy on <date>, resolved product data migration on <date>. Sources: Project Context hub, Changelog (last 3 entries).`

**Failure modes to verify:**
- **Ambiguous match:** change input to `what's the status of Jumpstart?` when two Jumpstart-named projects exist. Skill must list numbered matches and ask once, then answer against the user's pick — not ask repeatedly.
- **Unknown project:** change input to `what's the status of Zephyr?`. Skill must respond "I don't see a project called Zephyr..." and offer the closest match — must NOT scaffold automatically.
- **Write-intent follow-up:** after the status summary, reply "actually that Stripe thing is resolved — we got the creds yesterday." The skill must hand off to `cortex-update-context` and NOT silently edit the hub.

---

## Scenario 5 — "log that we're using Stripe" where Tech Stack says Braintree → `cortex-update-context` + Conflict Rule fires

**Trigger phrase(s) or structural signal:** Literal: `we're using <X>` (decision capture). Row 7 of the routing table.

**Pre-conditions:**
- Baseline vault state. Session is L3 in FKT (either via cwd or the user has clearly named FKT).
- FKT's `Tech Stack & Architecture.md` currently lists Braintree as the payment processor (set this up explicitly before the test).
- FKT Changelog has no recent Stripe/Braintree entry.

**User input:** `log that we're using Stripe for payments on FKT`

**Expected skill routed to:** `cortex-update-context`. (Disambiguation: "log that" and "we're using" both fire; disambiguation rule #2 says explicit beats inferred, and both are write-side.)

**Expected behavior:**
- Change type identified as **technical decision** (payment processor).
- Routing table: primary file is the Tech Stack & Architecture sub-note; also update Changelog.md and `_changelog.txt`.
- Step 4 Conflict Check: reads the Tech Stack sub-note, finds existing Braintree decision, detects a contradiction.
- **STOPS** before writing anything. Surfaces the Conflict Rule output listing: new info (Stripe), existing info (Braintree), file path of the contradiction (`.../Tech Stack & Architecture.md`).
- Asks how the user wants to resolve.
- If the user confirms "use Stripe": applies the write, bumps `updated:` frontmatter, adds a Changelog entry that mentions the supersession (e.g., `2026-04-08 · Switched from Braintree to Stripe · Ben · Previous Braintree decision superseded.`), and logs both file ops to `_changelog.txt`.

**Expected vault mutations (AFTER user confirms the supersession):**
- `Work/TBL/Frankl & Thomas/Shopify Website Build/Tech Stack & Architecture.md` — Stripe replaces Braintree; `updated:` bumped.
- `Work/TBL/Frankl & Thomas/Shopify Website Build/Changelog.md` — new entry noting the Stripe switch and supersession.
- `_changelog.txt` — two `UPDATED` lines (one for Tech Stack, one for Changelog.md).

**Expected vault mutations (BEFORE user confirms):** **None.** The conflict check stops writes.

**Expected chat output (one line or short summary):** `CONFLICT DETECTED: Tech Stack & Architecture currently lists Braintree for payments. The new decision switches to Stripe. How would you like to resolve this?` — then, after confirmation, `Updated FKT: payment processor switched from Braintree to Stripe in Tech Stack. Logged to Changelog.`

**Failure modes to verify:**
- **User declines the supersession:** verify that NO files are modified and NO changelog lines are written.
- **Tech Stack file doesn't exist:** skill must surface "`Tech Stack & Architecture.md` is missing from FKT. Want me to scaffold it from the template?" — must NOT auto-create.

---

## Scenario 6 — "that blocker is resolved" → `cortex-update-context` + Blocker-Resolved Rule

**Trigger phrase(s) or structural signal:** Literal: `that's resolved` / `blocker resolved` / `unblocked` / `we got <X>`. Row 9 of the routing table.

**Pre-conditions:**
- Baseline vault state. Session is L3 in FKT.
- FKT hub's Open Questions table contains a row exactly like: `| 1 | Waiting on Stripe sandbox credentials | Dependency | Client | Open |`.
- There is at least one other row in Open Questions so renumbering can be verified.

**User input:** `we got the Stripe sandbox creds — that blocker is resolved`

**Expected skill routed to:** `cortex-update-context` (blocker-resolved intent).

**Expected behavior:**
- Change type identified as **blocker resolved**.
- Routing: primary file is the Hub Open Questions table (remove the row); also update `Changelog.md` and `_changelog.txt`.
- Reads the hub. No conflict.
- **Removes the Stripe sandbox row entirely** — NOT a strikethrough, NOT a "resolved" status in-place. The row is gone.
- Renumbers remaining rows if they were numbered.
- Bumps `updated:` in the hub frontmatter.
- Writes a Changelog.md entry with today's date, what resolved, and any context from the conversation (`2026-04-08 · Stripe sandbox credentials received · Client · Blocker open since <date> resolved. Sandbox access confirmed.`).
- Logs two lines to `_changelog.txt` (hub UPDATED + Changelog.md UPDATED).

**Expected vault mutations:**
- `Work/TBL/Frankl & Thomas/Shopify Website Build/Shopify Website Build — Project Context.md` — Stripe row removed from Open Questions, remaining rows renumbered, `updated:` bumped.
- `Work/TBL/Frankl & Thomas/Shopify Website Build/Changelog.md` — new resolution entry.
- `_changelog.txt` — two UPDATED lines.

**Expected chat output (one line or short summary):** `Cleared Stripe sandbox blocker on FKT. Logged resolution to Changelog.`

**Failure modes to verify:**
- **Blocker not in Open Questions:** remove the Stripe row from the hub BEFORE running. Skill must surface "I don't see that blocker in FKT's Open Questions. Should I add the resolution to the Changelog only, or is this a blocker from a different project?" — must NOT silently add a Changelog entry.
- **Strikethrough mistake:** verify the row is *deleted*, not wrapped in `~~...~~`. Any strikethrough is a test failure.

---

## Scenario 7 — Granola transcript pasted → `cortex-process-meeting` + threading + handoff to `cortex-update-context`

**Trigger phrase(s) or structural signal:** Structural. User pastes a 20+ line transcript with `Name: text` speaker labels (or Granola MCP returns a transcript in the current turn). Rows 12 and 14 of the routing table.

**Pre-conditions:**
- Baseline vault state. Session is L2 or L3.
- `Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/` already contains at least 3 prior files named like `2026-03-18 FKT Standup.md`, `2026-03-25 FKT Standup.md`, `2026-04-01 FKT Standup.md` — establishing an "FKT Standup" series.
- The most recent (`2026-04-01 FKT Standup.md`) has a `*Related:*` line in its footer but NO `*Next:*` link.
- Today is 2026-04-08.

**User input:** Paste ~40 lines of a transcript in the form:
```
Ashley: Morning everyone, quick standup for FKT.
Ben: Yep, ready.
Ashley: We decided last night to move the checkout to Rebuy instead of ReCharge.
Ben: Noted. Also we're deferring the wholesale portal to phase 2.
Ashley: Stripe sandbox creds landed this morning — I'll forward them after this.
...
```
The title hint in the paste is "FKT Standup 2026-04-08" (or derivable from context).

**Expected skill routed to:** `cortex-process-meeting`. This skill then hands off to `cortex-update-context` for the extracted decisions.

**Expected behavior:**
1. Skill identifies context: primary subject is the FKT project's scoped work → project-scope routing. Destination: `Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/`.
2. Extracts decisions (`move checkout to Rebuy`, `defer wholesale to phase 2`) and a blocker-resolved (`Stripe sandbox creds received`).
3. Creates `Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/2026-04-08 FKT Standup.md` with frontmatter (`type: meeting-notes`, `source: granola` if from MCP, `#source/granola`, `#source/client`, `#type/meeting-notes` tags, quoted).
4. Detects the "FKT Standup" series (3 prior entries), threads the new note: adds `*Previous:* [[2026-04-01 FKT Standup]]` to the new note's footer.
5. Edits `2026-04-01 FKT Standup.md` to add `*Next:* [[2026-04-08 FKT Standup]]`, preserving its existing `*Related:*` line.
6. Hands off a single consolidated `cortex-update-context` invocation with: 2 decisions + 1 blocker-resolved. That call writes the hub changes and Changelog.md entries per Scenarios 5 and 6's logic (one confirmation line, not multiple).
7. Updates `Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/_MOC.md` to list the new meeting.
8. Logs every file operation to `_changelog.txt`.

**Expected vault mutations:**
- Created: `Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/2026-04-08 FKT Standup.md`.
- Modified: `Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/2026-04-01 FKT Standup.md` (added `*Next:*`).
- Modified: `Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/_MOC.md` (new entry).
- Modified: `Work/TBL/Frankl & Thomas/Shopify Website Build/Shopify Website Build — Project Context.md` (Rebuy decision, wholesale scope change, Stripe blocker removed).
- Modified: `Work/TBL/Frankl & Thomas/Shopify Website Build/Changelog.md` (3 new entries).
- `_changelog.txt` — multiple CREATED/UPDATED lines.

**Expected chat output (one line or short summary):** `Meeting note filed: 2026-04-08 FKT Standup. Threaded with 2026-04-01. Extracted 2 decisions and 1 resolved blocker to FKT's hub + Changelog.`

**Failure modes to verify:**
- **First-in-series meeting:** remove the 3 prior standup files before running. Skill must skip threading, not crash, and announce `(first in this series)` or similar.
- **Ambiguous project:** remove FKT-specific keywords from the transcript paste and rename the file hint to something neutral. Skill must ask once: "Which project does this meeting belong to?" and wait for a response before creating the file.
- **No decisions in transcript:** paste a pure-social-call transcript. Skill must create the note, SKIP the `cortex-update-context` handoff, and announce `Meeting filed. No decisions or blockers extracted.`

---

## Scenario 8 — "new project: Jane's Garden Shop / WordPress Rebuild" → `cortex-ingest-project` with new-client creation

**Trigger phrase(s) or structural signal:** Literal: `new project` / `start tracking` / `scaffold a project for <X>`. Row 10 of the routing table.

**Pre-conditions:**
- Baseline vault state.
- `Work/Personal/Jane's Garden Shop/` does NOT exist. This is a brand-new client AND a brand-new project.
- Session is L2 (inside the vault) or L1 (outside) — either works. Not in any registered repo.

**User input:** `new project: Jane's Garden Shop, WordPress Rebuild. Goals: migrate existing WP site to new hosting, redesign homepage. Integrations: WooCommerce, Mailchimp. Launching in 6 weeks.`

**Expected skill routed to:** `cortex-ingest-project`.

**Expected behavior:**
1. Parses the user's message. Extracts: goals, integrations, timeline.
2. Asks up to 3 clarifying questions focused on scope and dependency readiness (NOT aesthetics). For example:
   - "Is the WooCommerce migration including product data, or just the plugin setup?"
   - "Do you have access to the current hosting account yet?"
   - "Is the Figma file approved, or still in review?"
3. Offers 3 emoji suggestions (e.g. 🛒 🪴 🏗️) or lets the user type their own.
4. Reads `personality.md` to get `bucket_term` and the sub_note_types for the target bucket (Clients → Personal).
5. Determines that `Work/Personal/Jane's Garden Shop/` does not exist. Creates the full client scaffold:
   - `Work/Personal/Jane's Garden Shop/_MOC.md`
   - `Work/Personal/Jane's Garden Shop/Jane's Garden Shop — Client Context.md`
   - `Work/Personal/Jane's Garden Shop/Meetings/_MOC.md`
6. Then creates the full project scaffold inside the new client:
   - `Work/Personal/Jane's Garden Shop/WordPress Rebuild/_MOC.md`
   - `Work/Personal/Jane's Garden Shop/WordPress Rebuild/WordPress Rebuild — Project Context.md` (status: `Planning`)
   - `Work/Personal/Jane's Garden Shop/WordPress Rebuild/Tech Stack & Architecture.md`
   - `Work/Personal/Jane's Garden Shop/WordPress Rebuild/Design System.md`
   - `Work/Personal/Jane's Garden Shop/WordPress Rebuild/Changelog.md`
   - `Work/Personal/Jane's Garden Shop/WordPress Rebuild/Notes/_MOC.md`
7. Unanswered clarifying questions are recorded as rows in the new hub's Open Questions table.
8. Updates `Work/Personal/_MOC.md` and `Work/_MOC.md` to include the new client/project.
9. Asks: "Does this project have a code repo to link?" — if yes, hands off to `cortex-register-repo`; if "later", notes in the hub's Resources section.
10. Announces the final file list with counts.

**Expected vault mutations:** 9+ new files created (client scaffold + project scaffold), 2 MOCs updated (Work, Work/Personal), multiple `CREATED` lines in `_changelog.txt` (one per file).

**Expected chat output (one line or short summary):** `Project Scaffolded — 🛒 WordPress Rebuild. Client created: Jane's Garden Shop (new client in Personal). Files: 9 created. Open Questions: 3 (WooCommerce scope, hosting access, Figma approval).`

**Failure modes to verify:**
- **Name collision:** change the pre-conditions so `Work/Personal/Jane's Garden Shop/WordPress Rebuild/` already exists. Skill must detect the collision, switch to **update mode**, announce `Project already exists — updating instead of scaffolding.`, and hand off the user's input to `cortex-update-context`. It must NOT overwrite the existing hub.
- **Filesystem write fails mid-scaffold** (simulate by making the target client directory read-only after step 5 starts): skill must roll back any partial writes from this invocation, log the rollback to `_changelog.txt`, and NOT leave a half-scaffolded project folder behind.
- **`personality.md` missing:** the skill must hand off to `cortex-onboarding` and NOT proceed — it cannot scaffold without knowing the user's vocabulary.

---

## Scenario 9 — "worth remembering — the Shopify CLI schema.json quirk" → `cortex-knowledge` with reusability test pass

**Trigger phrase(s) or structural signal:** Literal: `worth remembering`. Row 15 of the routing table.

**Pre-conditions:**
- Baseline vault state. Session is L3 in FKT.
- `Knowledge Base/` exists with a `_MOC.md`.
- There is NO existing article about Shopify CLI schema.json validation in `Knowledge Base/` (confirm by grepping the folder for "Shopify CLI" / "schema validation" / "shopify theme dev").
- FKT's Changelog has an entry for today related to local dev work.

**User input:** `worth remembering — when you clone a Shopify theme locally with the CLI, the schema.json validation is way stricter than Shopify Admin's UI. You need to explicitly declare every 'default' value even if it matches the type default, or shopify theme dev throws.`

**Expected skill routed to:** `cortex-knowledge`.

**Expected behavior:**
1. Apply the **Reusability Test**: would this apply to other projects? Answer: any future Shopify theme build. → **Reusable. Proceed.**
2. Check `Knowledge Base/_MOC.md` and search for related keywords ("Shopify CLI", "schema validation", "shopify theme dev"). No existing article found.
3. Identify knowledge type: vendor/tool note. Use the `Quirk / Workaround / Context` structure.
4. Create `Knowledge Base/Shopify CLI — schema.json validation stricter than Admin.md` with proper frontmatter (`#type/reference` or `#type/knowledge`, `#domain/shopify`, `#status/evergreen`, quoted tags).
5. The Context section references today's discovery date and the FKT project as the source.
6. Add `*Source:* [[Shopify Website Build — Project Context]]` (or `*Source:* [[<FKT hub>]]`) to the new article.
7. Bidirectional cross-link: edit FKT's `Changelog.md` (today's entry) to add `[[Shopify CLI — schema.json validation stricter than Admin]]` in a related line.
8. Update `Knowledge Base/_MOC.md` to list the new article.
9. Log each file op to `_changelog.txt`.

**Expected vault mutations:**
- Created: `Knowledge Base/Shopify CLI — schema.json validation stricter than Admin.md`.
- Modified: `Knowledge Base/_MOC.md` (new entry).
- Modified: `Work/TBL/Frankl & Thomas/Shopify Website Build/Changelog.md` (backlink added to today's entry).
- `_changelog.txt` — CREATED + 2 UPDATED lines.

**Expected chat output (one line or short summary):** `Extracted 'Shopify CLI schema.json validation' to Knowledge Base. Cross-linked to FKT.`

**Failure modes to verify:**
- **Reusability test fails:** re-run with the user saying "worth remembering — we decided to run the FKT inventory sync every 15 min because their Sage instance times out." Skill must detect this is project-specific (FKT's Sage config), ask "That sounds specific to how FKT's Sage instance is configured rather than a reusable pattern. Want me to log it to FKT's Tech Stack instead?", and on confirmation hand off to `cortex-update-context` rather than writing to `Knowledge Base/`.
- **Article already exists:** pre-create `Knowledge Base/Shopify CLI — schema.json validation stricter than Admin.md`. Skill must enter update mode, detect the user's input adds nothing new, respond "That's already in Knowledge Base... nothing new to add. Want me to open it?", and NOT bump the article's `updated:` field for no-op input.

---

## Scenario 10 — "scan for repos" → `cortex-register-repo` backfill with confirmation list

**Trigger phrase(s) or structural signal:** Literal: `scan for repos` / `backfill repos` / `find my project folders` / `register all my repos`. Row 18 of the routing table.

**Pre-conditions:**
- Baseline vault state.
- `~/Documents/Freelance Projects/` exists and contains the following immediate subdirectories:
  - `fkt-checkout/` — contains an existing Cortex stub `CLAUDE.md` (already a strong match to FKT)
  - `jumpstart-wp/` — no `CLAUDE.md`, fuzzy-matches Jumpstart SC
  - `fond-homepage/` — no `CLAUDE.md`, fuzzy-matches FOND
  - `random-sandbox/` — no `CLAUDE.md`, no fuzzy match to any vault project
- `registry.json` does NOT yet contain `jumpstart-wp`, `fond-homepage`, or `random-sandbox` (the scan should have work to do).

**User input:** `scan for repos`

**Expected skill routed to:** `cortex-register-repo` → **Backfill** sub-operation.

**Expected behavior:**
1. Asks for scan roots, defaulting to `~/Documents/Freelance Projects/`. User accepts default.
2. Walks the root one level deep. Classifies each subdir:
   - `fkt-checkout/` — Strong (existing Cortex stub)
   - `jumpstart-wp/` — Possible (fuzzy match: Jumpstart SC)
   - `fond-homepage/` — Possible (fuzzy match: FOND)
   - `random-sandbox/` — No Match
3. Presents a **confirmation list** to the user. Each row has `[Y/n/skip]` per repo. Nothing is registered until the user responds.
4. User responds (e.g., `Y Y Y skip`).
5. Calls the Register sub-operation once per confirmed match:
   - For `jumpstart-wp/`: appends to Jumpstart SC's `repo_paths` in `registry.json`, writes a new Cortex stub `CLAUDE.md` into the repo.
   - For `fond-homepage/`: same, for FOND.
   - For `fkt-checkout/`: registry entry already exists — skill recognizes the existing stub and does NOT overwrite it; logs as a conflict-noted-but-kept.
6. Logs 2 lines to `_changelog.txt` per newly-registered repo (one for the registry update, one for the stub).
7. Summarizes: `Registered: 2 repos (jumpstart-wp, fond-homepage). Skipped: 1 (random-sandbox). Conflicts: 1 (fkt-checkout — kept existing Cortex stub).`

**Expected vault mutations:**
- Modified: `<vault>/.claude/cortex/registry.json` — two new `repo_paths` entries (one for Jumpstart, one for FOND).
- `_changelog.txt` — 4+ new lines (2 per newly-registered repo).

**Expected filesystem mutations OUTSIDE the vault:**
- Created: `~/Documents/Freelance Projects/jumpstart-wp/CLAUDE.md` (Cortex stub).
- Created: `~/Documents/Freelance Projects/fond-homepage/CLAUDE.md` (Cortex stub).
- Unchanged: `~/Documents/Freelance Projects/fkt-checkout/CLAUDE.md` (pre-existing stub preserved).
- Unchanged: `~/Documents/Freelance Projects/random-sandbox/` (no files touched).

**Expected chat output (one line or short summary):** `Backfill complete. Registered: 2 repos. Skipped: 1. Conflicts: 0 (fkt-checkout had existing CLAUDE.md — kept existing since it was already a Cortex stub).`

**Failure modes to verify:**
- **Auto-register attempt:** verify the skill ALWAYS shows the confirmation list and waits for Y/skip input. There must be no path in which any repo is silently registered without explicit per-repo confirmation. This is the "destructive-adjacent" rule for backfill.
- **20+ repos in scan root:** add 20 additional junk folders with project-like names. Skill must paginate (10 per page), take one batch of confirmations, then continue to the next batch. No silent auto-registration.
- **Scan root doesn't exist:** user supplies a bad path. Skill must re-prompt with valid options, not fall back silently to the default.
- **Non-existent target project for a match:** if the user types a project name during confirmation that doesn't exist in the vault, the skill must NOT create the project — it must hand off to `cortex-ingest-project` or surface the missing project.

---

---
avatar_id: "10"
persona: "Therapist/coach — HIPAA-class confidentiality, per-client notes, hates anything that might sync"
surface: "Claude Desktop"
audit_date: 2026-06-01
auditor: claude-sonnet-4-6 (subagent)
---

# Daily-Use Audit — Avatar 10: Therapist/Coach

## Persona

A licensed therapist in private practice who also does executive coaching. Uses Obsidian as their clinical notes system. Every client has their own folder under a `Clients/` bucket. Notes contain session themes, therapeutic hypotheses, medication considerations, and intake paperwork summaries — all of which are HIPAA-sensitive. The vault is stored entirely locally on a personal Mac; iCloud sync is explicitly disabled for the vault folder. They are very aware of data-at-rest vs. data-in-transit distinctions. They are NOT a developer. They run Claude Desktop, not Claude Code. They open Claude for two primary daily tasks: processing session notes after seeing clients, and checking on a client's history before the next appointment.

## Simulated Day-in-the-Life

**8:45 AM** — Opens Claude Desktop before first client at 9. Boot fires: `session-start` runs `boot-context.py`. The vault is at `~/Documents/Vault`, personality.md exists, and there are 3 clients in the registry. No repo matches cwd (`~/Documents`), and the vault root is `~/Documents/Vault` — so `is_inside_vault` is false. Level: L1 — Passive. `cortex-boot` says nothing, loads memory silently. Good start.

**9:50 AM** — Session with Client A ends. Therapist opens Claude and pastes a 40-line stream-of-consciousness session summary (no speaker labels — just prose notes they typed during the session). They type: "here are my notes from my session with Client A."

The `user-prompt-submit` hook matches `*"here are the notes from"*` (line 75 in `hooks/user-prompt-submit`) and routes to `cortex-process-meeting` with confidence=high. The skill fires. It asks which project, the therapist confirms "Client A" (mapped to the `Clients/Client A/` bucket). A note is created, threaded into the "Session Notes" series, decisions extracted, and a Tier 1 capture runs silently. The therapist sees: "Session note filed: 2026-06-01 Session Notes.md. Threaded. Extracted 2 notes to hub."

**Problem surfaces here** — see Finding 1.

**11:15 AM** — Between clients. Therapist types: "what's the status of Client B — are we still working on the perfectionism themes?" `cortex-check-status` fires. It reads `Clients/Client B/Client B — Project Context.md` and the Changelog. Response cites both files.

**Problem surfaces here** — see Finding 2.

**12:30 PM** — Lunch. Therapist has been reading a book on DBT. They think: "this reframing technique could apply to multiple clients" and say to Claude: "worth remembering — when a client catastrophizes, naming the emotion before the cognitive distortion cuts through faster than challenging the thought directly." `cortex-knowledge` triggers (row 15, trigger-phrase "worth remembering"). It runs the reusability test: "would help on multiple clients" → writes to `Knowledge Base/`.

**Catastrophic problem surfaces here** — see Finding 3.

**2:00 PM** — Session with Client C. Therapist wants a quick reminder of what they've been working on. They type: "what were Client C's main themes from last session?" Claude fires `recall_related` (from `cortex-boot` ambient recall). It queries the sqlite-vec DB at `.cortex/search.db` inside the vault. Returns 5 semantically related notes. Among them: notes from Client A and Client B that score >0.5 because they share common clinical language ("anxiety", "avoidance", "homework").

**Privacy problem surfaces here** — see Finding 4.

**3:30 PM** — Therapist is in Client D's session and pulls Claude up to quickly check something. They paste a 22-line transcript of what the client just said (verbatim, because they're testing if Claude can detect a cognitive distortion pattern). The `user-prompt-submit` hook detects 3+ lines matching `^[A-Za-z]+: ` — in this case the client's name appears at the start of each reported speech fragment: "Client: I just can't do anything right. Client: Everyone hates me."

Structural trigger fires: `cortex-process-meeting` is invoked with confidence=high. The therapist did NOT intend to file this as a meeting note — they wanted to ask a quick clinical question.

**Problem surfaces here** — see Finding 5.

**5:00 PM** — End of day. Therapist wraps a notes session. The `stop` hook fires. It flushes `pending-memory.json` to `memory.md`. The therapist did NOT explicitly authorize those memory entries — they were captured ambiently during the day by Tier 1 rules.

**Problem surfaces here** — see Finding 6.

---

## Findings

### Finding 1 — P1: Meeting-note extraction runs silently for clinical session notes without confirming content written to hub

**Area:** capture

**Evidence:** `references/capture-rules.md` lines 22–33: Tier 1 fires automatically with "No user confirmation required." The capture table includes "Client or collaborator preference stated → Project hub Contacts section" and "Meeting transcript or summary shared → Project Notes/ folder."

When `cortex-process-meeting` extracts "decisions" and "client preferences" from a clinical session note and writes them to the Project Context hub (`Clients/Client A — Project Context.md`) with a Tier 1 silent write, the therapist has no easy way to audit *exactly* what was written. The confirmation line is deliberately minimal: `"Session note filed: 2026-06-01 Session Notes. Extracted 2 notes to hub."` The YAML frontmatter `updated:` is bumped (see `cortex-update-context/SKILL.md` line 101: "No exceptions").

For a therapist, what gets classified as a "client preference" vs. a "decision" vs. a clinical observation matters enormously. A statement like "Client A expressed she prefers morning appointments" is benign. A statement like "Client A disclosed history of self-harm" being silently classified as a "client preference" and written verbatim to the hub is a qualitatively different thing. There is no mechanism for the therapist to review-and-approve before the hub write, only to read the one-line confirmation after.

**Impact:** PHI could be misclassified and written to high-visibility hub files without the therapist reviewing the exact extracted text. The confirmation line does not show the extracted content, only a count.

**Suggested fix:** For personas using a `type: "confidential-client"` or equivalent bucket marker in `personality.md`, require Tier 2 (ask-before-write) for all hub writes from `cortex-process-meeting`. Alternatively: show the extracted content in the confirmation line so the therapist can immediately spot misclassification and say "don't capture that" (which the capture-rules failure mode does support, but only after the write has already happened).

---

### Finding 2 — P0: `_changelog.txt` and `Changelog.md` contain client names and session themes in plaintext with no access control

**Area:** privacy

**Evidence:** `hooks/post-tool-use` lines 181–192: every file write appends a timestamped entry to `_changelog.txt`. The format is `[YYYY-MM-DD HH:MM] ACTION | FILE: filename | DEST: path | NOTE: <context>`. The `NOTE:` field comes from either `"Auto-logged by hook"` or a user-supplied note string from `append_changelog.js`.

`cortex-update-context/SKILL.md` lines 143–147 (worked example Step 8) shows the note field containing clinical content: `NOTE: Stripe sandbox credentials received` — but for a therapy vault, this would be `NOTE: Client A disclosed childhood trauma` or `NOTE: Cleared blocker (suicidal ideation resolved)`.

`_changelog.txt` is a flat append-only text file at the vault root. It is not encrypted. It is indexed by the `indexer.js` walk? Let's check: `indexer.js` line 10 defines `EXCLUDED_DIRS` — `_changelog.txt` is a `.txt` not a `.md`, so it's not walked for embedding. However, the `boot-context.py` `read_changelog` function at line 72 reads the last 15 lines and **injects them into the session context block** as `Recent activity:`. This means client names and session themes from the NOTE field flow into the `<cortex-session>` block sent to the model on every boot.

**Impact:** Every session, the last 15 changelog lines (potentially containing client names and clinical content) are sent to the Anthropic API as part of the session-start context. For a HIPAA-context user, this is a data-at-rest-to-in-transit boundary crossing that they almost certainly have not consented to, and which the system does not disclose.

**Suggested fix:** Add a `changelog_redact_recent_activity: true` option in `config.json` that suppresses the `Recent activity:` block from being sent in `<cortex-session>`. Alternatively, limit `recent_activity` in the session block to filenames only, never NOTE field content. Document this behavior prominently in the setup guide for confidentiality-sensitive personas.

---

### Finding 3 — P0: `recall_related` semantic search returns notes across ALL vault buckets, with no per-bucket access isolation

**Area:** recall

**Evidence:** `mcp-servers/cortex-vault/tools/recall-related.js` lines 68–75: the SQL query is:

```sql
SELECT n.path AS path, n.title AS title, v.distance AS distance
FROM vec_notes v
JOIN notes n ON n.id = v.rowid
WHERE v.embedding MATCH ? AND v.k = ?
ORDER BY v.distance
```

There is no `WHERE n.path LIKE 'Clients/Client C/%'` or any bucket scope filter. The query runs against the entire vault's `vec_notes` table. The only filtering is `exclude_paths` (a list of specific files to exclude).

The `indexer.js` `walk` function at line 12 explicitly indexes everything not in `_Templates`, `Archives`, `.cortex`, `node_modules`, or hidden dirs. All client folders are indexed. When the therapist asks "what were Client C's themes last session?", the ambient `recall_related` call passes the context string containing clinical terminology and gets back the 5 most semantically similar notes from the entire vault — which will include notes about Client A, B, and D, because clinical language (anxiety, avoidance, rumination, cognitive distortion) is shared across clients.

**Impact:** Cross-client note contamination on every recall invocation. The model is fed notes about other clients when the user is asking about a specific client. This is a direct HIPAA violation in clinical practice. A therapist who notices "Worth knowing: you documented similar themes in [[Client A — Session 2026-05-12]]" while working on Client C's session would be alarmed — and rightly so.

**Suggested fix:** Add a `scope` parameter to `recall_related` that restricts the SQL query to paths under a given vault-relative prefix (e.g., `scope: "Clients/Client C/"`). The calling skill (`cortex-boot` step 6) should pass the current project's `vault_path` as the scope when in L3. For L1/L2 sessions where no project context is active, `recall_related` should be entirely suppressed for buckets marked `type: "confidential"` in `personality.md`.

---

### Finding 4 — P1: `personality.md` is loaded wholesale into every session's `<cortex-session>` block, including client bucket names

**Area:** boot

**Evidence:** `hooks/lib/boot-context.py` lines 432–433: `extract_buckets(personality)` is called for L1/L2 sessions and the result is sent as `Active projects:` in the session block. The `extract_buckets` function (lines 94–108) pulls all bucket `name` and `type` fields from `personality.md` YAML frontmatter.

The full `personality` string is also sent verbatim as `<cortex-personality>` content (session-start lines 84–87). For a therapist, `personality.md` contains client names in the bucket list. Example: `buckets: [{name: "Marcus Williams", type: "client"}, {name: "Jennifer Cho", type: "client"}]`.

Every session start sends all client names to the API. There is no filtering. The `apply_token_budget` function prioritizes `personality` second (after `project`), so it will almost never be truncated in a normal vault. Client names go to the Anthropic API on every session boot, whether or not the session has anything to do with those clients.

**Impact:** Client names are transmitted to the Anthropic API on every Claude session regardless of context. A therapist who understands that "session context goes to the model" would be very uncomfortable knowing their full client list is transmitted every time they open Claude to write a grocery list.

**Suggested fix:** Add a `privacy_level` field to bucket entries in `personality.md` (e.g., `privacy_level: "confidential"`). In `extract_buckets` and the personality content block, redact confidential bucket names to a count only (`3 confidential clients`) rather than named entries when the user has set a global `privacy_mode: "hipaa"` in `config.json`. Alternatively, allow `personality.md` to reference a separate `clients.md` that is excluded from boot injection.

---

### Finding 5 — P1: Transcript structural trigger misfires on verbatim client speech (speaker-label heuristic is too broad)

**Area:** capture

**Evidence:** `hooks/user-prompt-submit` lines 60–68: the structural transcript detection checks two conditions: `LINE_COUNT >= 20` AND `SPEAKER_COUNT >= 3` where `SPEAKER_COUNT` is lines matching `^[A-Za-z]+: ` (grep, line 63).

A therapist's clinical notes routinely contain verbatim client quotes in the format "Client: [quote]" or use the client's first name as a speaker identifier. If the therapist pastes 20+ lines of session notes to ask a clinical question ("does this pattern suggest dissociative avoidance?"), the structural trigger fires and routes to `cortex-process-meeting` with `confidence: high` — overriding any other intent.

The `cortex-process-meeting` skill will then attempt to file the paste as a meeting note, potentially creating a new session note, threading it into a series, extracting "decisions" from clinical content, and writing to the project hub — all without the therapist explicitly requesting any of this.

**Impact:** Routine clinical analysis queries are silently converted to vault writes. The therapist asks a question; Cortex starts filing paperwork. This is high-friction, potentially creates duplicate notes, and writes unreviewed content to the hub.

**Suggested fix:** The structural trigger in `user-prompt-submit` should be degraded from `confidence: high` to `confidence: medium` for pastes that lack a clear temporal marker (no date, no "meeting with", no "call") in the first 3 lines. A `cortex-hint` with `confidence: medium` should cause `cortex-process-meeting` to ask "Should I file this as a session note, or did you want to ask a question about it?" rather than proceeding directly. The therapist gets to choose.

---

### Finding 6 — P2: The stop hook flushes `pending-memory.json` to `memory.md` without surfacing what was written, and memory.md is indexed into semantic search

**Area:** capture

**Evidence:** `hooks/stop` lines 138–170: the flush loop reads each entry's `content` field and appends it to `memory.md` with no preview shown to the user before writing. The hook outputs only `"Flushed N pending memory update(s) to vault memory.md."` — no content summary.

`lib/indexer.js` `walk` (line 22) does not exclude `memory.md`. It will be indexed into `search.db` and become a candidate for `recall_related` results. This means clinical language that accumulates in `memory.md` (from Tier 1 ambient captures across sessions) will contaminate cross-client recall results.

Additionally, `boot-context.py` `read_memory` at line 45 tail-reads up to 100 lines of `memory.md` and injects them into every session's `<cortex-session>` block. If memory has accumulated entries about specific clients from past sessions, those client names and clinical themes flow to the API on every subsequent boot.

**Impact:** Memory grows unbounded with clinical content. Over weeks of use, `memory.md` will contain a dense summary of all clients' presenting concerns, which (a) goes to the API every session via the boot block, and (b) contaminates recall results. There is no mechanism to expunge memory entries about a specific client (e.g., after termination of care).

**Suggested fix:** Add a `memory_exclude_buckets: ["Clients"]` config option that prevents Tier 1 ambient capture from writing client-bucket content into `memory.md`. Client-specific context belongs in the per-client hub, not in the cross-session memory file. Separately, provide a `/cortex-memory purge --bucket "Client A"` command to remove all memory entries associated with a specific client. Document the memory persistence behavior in the onboarding flow for confidential-use personas.

---

## Summary

This persona exposes Cortex's most significant architectural blind spot: the system was designed for a knowledge worker managing project work, and every layer of the daily loop — boot injection, ambient capture, recall, memory flush — assumes all vault content is safe to cross-reference, transmit to the API, and surface proactively. For a therapist, none of those assumptions hold. The vault is a clinical record system. Cross-client recall is not a feature; it's a HIPAA incident. Injecting client names into every session boot is not personalization; it's unnecessary PHI transmission. The structural transcript trigger that converts a clinical question into a vault write is not helpful automation; it's an obstacle to normal work.

None of these are bugs in the sense of broken code. The code does exactly what it was designed to do. The gap is that no design constraint was ever placed on the system to support confidential-bucket semantics. The path forward is a `privacy_mode` configuration tier that gates the most sensitive cross-bucket behaviors.

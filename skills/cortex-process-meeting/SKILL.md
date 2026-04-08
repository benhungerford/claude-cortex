---
name: cortex-process-meeting
description: Takes a meeting transcript, Granola/Fathom export, email recap, or pasted notes and creates a properly-threaded meeting note in the correct project Notes/ folder (or client Meetings/ folder for non-project meetings). Handles series detection, Previous/Next threading, frontmatter, MOC updates, and extracts decisions and blockers into the project hub and Changelog by handing off to cortex-update-context. Fires on transcript paste, "process this meeting", or when a Granola/Fathom MCP tool returns a transcript.
---

# cortex-process-meeting

## Purpose

Turn a raw meeting into a fully-filed, properly-threaded vault note that extracts action items, decisions, and blockers into the right places. Routing between project `Notes/` and client `Meetings/` is the most nuanced part — project-scope meetings go under the project, relationship/brand/ops meetings go under the client.

The full playbook lives in `workflows/process-meeting.md`.

## When this skill fires

**Literal triggers:**
- "process this meeting"
- "here are the notes from <X>"
- "meeting notes:", "from my call with <X>"
- "file this meeting"

**Structural triggers:**
- User pastes a transcript (20+ lines, has speaker labels like `Name: text`)
- A Granola/Fathom MCP tool returns a transcript in the current turn (hard route)

See rows 12–14 in `references/trigger-phrases.md`.

## Procedure

Run `workflows/process-meeting.md`. The workflow covers:

1. **Identify meeting context** — which project (or client-level), meeting type, whether it's project-scoped or relationship/ops
2. **Extract decisions, action items, blockers, scope changes, client preferences, technical details**
3. **Create the meeting note** with `YYYY-MM-DD <Title>.md` naming, proper frontmatter, structured sections
4. **Thread with previous meetings** — find the most recent prior instance of the same series, add bidirectional `*Previous:*`/`*Next:*` links
5. **Update project context** — hand off each extracted decision/blocker to `cortex-update-context`
6. **Update MOC and log** — add to the project's `_MOC.md` under Meeting Notes, log to `_changelog.txt`, announce

## Critical rules

### Project-scope vs. client-level routing

The single most nuanced decision this skill makes. Ask:

> **"Is the primary subject of this meeting the scoped work of a specific project, or is it about the client relationship / brand / marketing / distribution / ops that lives beyond any one project?"**

| Answer | Destination |
|---|---|
| Primary subject is the project's scoped work (wireframe review, sprint planning, dev handoff, QA) | `Work/<cat>/<client>/<project>/Notes/` |
| Primary subject is client-level (kickoff before any project, brand strategy, marketing review, distribution, ops sync) | `Work/<cat>/<client>/Meetings/` |
| No client tie at all (peer conversation, networking, tool discovery) | `Work/Meetings/` |

**Bias toward client-level.** A status call that mentions the project once is still a client call. Only file under the project's `Notes/` if the primary subject is the project's scoped work.

See the routing tree in `Vault/.claude/rules/routing-rules.md` (the vault's own rules, not the plugin's).

### Threading rules

Meeting series get `*Previous:*`/`*Next:*` links. A series exists when:
- 3 or more meetings in the same folder share a stable title suffix (e.g., "Client Check-in", "FKT — Standup")
- The new meeting's title matches an existing series

**Threading procedure:**
1. List files in the destination folder matching `YYYY-MM-DD <Title>.md`
2. Group by the title-after-the-date
3. If the new meeting matches a group with 2+ prior entries, thread it
4. Add `*Previous:* [[<most-recent-prior>]]` to the new note's footer
5. Edit the most-recent-prior note to add `*Next:* [[<new-note>]]`
6. Preserve any existing `*Related:*` line on both notes — thread links are additive

**Do not thread** if:
- It's the first meeting in a series
- Cross-project meetings (use `*Related:*` instead)

### Decision/blocker extraction

Every decision, blocker, or scope change found in the transcript gets handed off to `cortex-update-context`, which handles the conflict-check and writes to the hub/Changelog. This skill is the *extractor*, not the writer — it calls the writer.

Batch the handoffs. If a meeting has 5 decisions and 2 new blockers, send them as a single consolidated `cortex-update-context` invocation so the user sees one confirmation line, not 7.

### Ambiguity asks

If the target project is unclear, ask **once**: "Which project does this meeting belong to?" Then proceed. Do not ask repeatedly.

If the meeting clearly isn't project-scoped but client-level and the client is unclear, ask: "This looks like a client-level meeting — which client?"

## Worked examples

### Example 1 — Granola transcript for a known project

```
Granola MCP tool returns a 300-line transcript for "FKT Standup — 2026-04-08".
Structural trigger → this skill fires.

Step 1: Identify context.
  Title matches existing "FKT Standup" series under FKT Shopify Website Build.
  Primary subject is the project's scoped work → project-scope routing.
  Destination: Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/

Step 2: Extract:
  decisions=["move checkout to Rebuy", "defer wholesale to phase 2"]
  action_items=["Ashley to send Stripe sandbox creds by Wed"]
  blockers_new=[]
  blockers_resolved=[]

Step 3: Create
  Work/TBL/Frankl & Thomas/Shopify Website Build/Notes/2026-04-08 FKT Standup.md
  with full frontmatter (source=granola, granola_id=<uuid>, #type/meeting-notes,
  #source/granola, #source/client).

Step 4: Thread with previous. Series has 4 prior entries. Most recent:
  2026-04-01 FKT Standup.md
  Add *Previous:* to new note. Edit 2026-04-01 to add *Next:*.

Step 5: Hand off 2 decisions + 1 action item to cortex-update-context:
  - Decision: move checkout to Rebuy
  - Decision: defer wholesale to phase 2
  - Action item → gets logged in meeting note only (not a separate open question
    unless the user asks for it).

Step 6: Update MOC, log to _changelog.txt. Announce:
  "Meeting note filed: 2026-04-08 FKT Standup. Threaded with last week's
   standup. Extracted 2 decisions to the hub + Changelog."
```

### Example 2 — Client-level kickoff meeting

```
User pastes notes from a Zoom call with a brand-new client, Jane's Garden Shop.
No project scaffolded yet.

Step 1: Identify context.
  Client: Jane's Garden Shop (new — does not exist in vault yet).
  Meeting type: kickoff / relationship.
  Primary subject is brand, scope possibilities, budget — NOT a specific
  project's scoped work → client-level routing.
  Destination: Work/Personal/Jane's Garden Shop/Meetings/ (which doesn't exist).

Pre-step: Client doesn't exist. Hand off to cortex-ingest-project? No —
  this is a client-level meeting, not a project yet. Instead, create the
  client folder structure (_MOC.md, Client Context.md, Meetings/) directly
  as part of meeting processing. Mark Client Context as a stub to fill later.

Step 3: Create
  Work/Personal/Jane's Garden Shop/Meetings/2026-04-08 Kickoff Call.md

Step 4: First in series, no threading.

Step 5: Extract any preliminary decisions, but most of the info is
  "scoping / possibilities" so no decisions yet. Nothing to hand off to
  cortex-update-context.

Step 6: Update MOC, log. Announce:
  "Created new client: Jane's Garden Shop (Personal). Filed kickoff meeting.
   No project scaffolded yet — say 'new project for Jane's Garden Shop' when
   ready."
```

### Example 3 — Meeting touches two projects

```
User: "here are notes from my call with FKT — we talked mostly about the
       Shopify build but also about the Bubl Shots compliance project for
       like 15 minutes at the end"

Step 1: Two projects touched. Primary is clearly FKT Shopify Website Build
  based on "mostly about". Destination: FKT/Shopify Website Build/Notes/.

Step 3: Create the meeting note under the primary.

Step 4: Thread with prior FKT meetings if applicable.

Cross-link: Add a *Related:* link to the Bubl Shots project context hub,
  AND add a reciprocal link from Bubl Shots's hub back to this meeting note
  (bidirectional linking rule from vault-conventions.md).

Step 5: Extract decisions from both halves of the meeting. Each decision
  gets routed to its own project's hub via cortex-update-context —
  FKT decisions → FKT hub, Bubl decisions → Bubl hub.

Step 6: Announce:
  "Meeting note filed under FKT. Cross-linked to Bubl Shots. Extracted 3
   FKT decisions and 1 Bubl scope note."
```

## Failure modes

| Failure | What to do |
|---|---|
| Can't tell which project the meeting belongs to | Ask once: "Which project does this meeting belong to?" If the user says "none / client-level", ask: "Which client?" |
| Meeting title suggests a series but the series doesn't exist in the destination folder | Treat as first in series — skip threading. Note in the announce line: `(first in this series)`. |
| Destination folder doesn't exist (new client, new project) | Create it as part of meeting processing. For new clients, create the client folder scaffold (`_MOC.md`, `Meetings/`, `<Client> — Client Context.md` stub). For new projects, hand off to `cortex-ingest-project` first. |
| Transcript is huge (10k+ lines) | Process it. Do not truncate. Extract decisions from the whole thing. But do not save the full transcript into the note — summarize in structured sections and link to the Granola/Fathom source via `granola_id` / `fathom_id` in frontmatter. |
| Transcript has no extractable decisions (pure social call) | Create the note with the transcript summary, skip the cortex-update-context handoff, announce: `Meeting filed. No decisions or blockers extracted.` |
| Two meeting notes in the same folder have identical title suffixes (rare but possible) | Thread to the most recent by `YYYY-MM-DD` prefix. |
| The series has a gap (e.g. user skipped a week) | Thread to the most recent *existing* instance, not the expected date. |
| The meeting discusses a blocker that doesn't exist in any project | Ask the user: "This blocker isn't in <Project>'s open questions. Add it as a new blocker or log it as context only?" |
| Conflicting information in the meeting (e.g. mid-meeting someone changes their mind) | Extract only the final decision from the meeting. Note the pivot in the meeting note's content, but only the final answer gets handed off to `cortex-update-context`. |

## What this skill does NOT do

- Does not transcribe. Assumes the input is already a text transcript or pasted notes.
- Does not summarize the whole meeting — extracts structured data (decisions, action items, blockers) and preserves the rest under a `## Notes` section.
- Does not write directly to the project hub — hands off to `cortex-update-context`.
- Does not interpret action items into follow-ups or reminders — lists them in the meeting note only.
- Does not send emails or create calendar invites from action items.

## Related

- **Workflow:** `workflows/process-meeting.md`
- **References:** `references/vault-conventions.md`, `references/capture-rules.md`
- **Handoff target:** `cortex-update-context` (for every extracted decision/blocker), `cortex-ingest-project` (if the meeting is a kickoff for unscaffolded work)
- **Callers:** `cortex-boot` (on structural transcript detection)
- **Triggers:** rows 12–14 in `references/trigger-phrases.md`

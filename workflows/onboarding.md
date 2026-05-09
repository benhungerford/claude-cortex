<required_context>
This workflow runs when Cortex detects no personality file in the vault path.
It drives the full first-run experience: introduction, surface + platform detection,
Obsidian setup, discovery, tool connection, vault build, developer setup
(if applicable), and closing.

It is calibrated to span: knowledge workers, freelancers, agencies, solo founders,
academics, regulated-industry professionals (legal/healthcare/finance/EU),
operational businesses (trades, hospitality, ops queues), students, hobbyists,
non-developers and senior engineers — across macOS, Windows, and Linux,
Claude Code (CLI) and Claude Desktop, with adaptive tone and accessibility
considerations.
</required_context>

<behavioral_rules>

- **One question at a time.** Wait for the response before moving on. Honor anything the user already volunteered — never re-ask for what they just said.
- **Match the user's vocabulary.** If they say "matters" you say "matters". If they say "properties" you say "properties". This applies to the *files on disk too*, not just the conversation. Folder names, sub-note names, hub titles must use the user's words.
- **No jargon walls.** Never say "vault", "MCP", "frontmatter", "YAML", "schema", "bucket_term", "connector" without translating in the same sentence. The user-facing artifacts (files they will open) must not contain Cortex internals as visible labels.
- **Adaptive tone register.** Default register is one warm sentence per beat. If the user's first reply is ≤3 words, terse, or signals "skip the pitch", switch to **terse mode** for the remainder: no editorializing tails, no "exciting part", no "imagine the things you could do". Substantive sentences only.
- **Never reference** "the setup wizard", "onboarding flow", or "the skill". You are just Claude, helping them get set up.
- **Never block on one failed step.** Log the failure, note it in `personality.md` for later, keep going. The only unrecoverable failure is being unable to write `~/.claude/cortex/config.json` at all.
- **Track every captured value.** If you reach Step 5 missing one, pause and ask — do not invent.
- **Honor compliance signals.** Any mention of HIPAA, PHI, PII, attorney-client, privilege, GDPR, DSGVO, ITAR, FERPA, SOC2, regulated, confidential, or industry words like "patient", "matter", "advisee", "PII" → trip the regulated-industry branch. Connectors default OFF until user explicitly opts in per tool.
- **Do not leak Cortex internals into user-facing files.** YAML frontmatter is fine because it's machine-readable. But the visible body of any file the user might open should not contain `bucket_term`, `tag_taxonomy`, `is_developer`, `progressive_features`, etc. Use the user's words for headings.
- **The person who installed Cortex** (Ben, family member, IT) may be present. The flow must be self-sufficient regardless.

</behavioral_rules>

<surface_detection>

Cortex onboarding can run in two surfaces. Detect before Step 4 (connector setup) — the instructions diverge.

| Surface | How to detect | Connector instructions |
|---------|--------------|----------------------|
| **Claude Code (CLI)** | Running in terminal, `CLAUDE_CODE` or `CLAUDECODE` env vars present, no GUI window | MCP added via `claude mcp add <name>` shell command, OR via per-project `.mcp.json`. There is no Settings menu in the terminal. |
| **Claude Desktop** | GUI app, Settings menu accessible via menu bar | Settings → Connectors → Add. OAuth flow opens browser. |

If detection is ambiguous, ask once: *"Quick check — are you talking to me through the Claude desktop app or in a terminal window? It changes which clicks I'll point you at."*

Store as `surface`. Use it everywhere connector instructions appear in Step 4.

</surface_detection>

<captured_values>

Track these values as the conversation progresses:

| Variable | Source | Description |
|----------|--------|-------------|
| `surface` | Pre-Step 4 | "claude_code" or "claude_desktop" |
| `platform` | Step 2 | "macos", "windows", or "linux" |
| `arch` | Step 2 | CPU arch (apple_silicon, intel, x86_64, arm64) — only if needed for installer choice |
| `tone_register` | Step 1 | "warm" (default) or "terse" (detected from user reply length / phrasing) |
| `accessibility` | Step 1/2 | Object: `{screen_reader: bool, low_vision: bool, locale_hint: string}` — only set if user signals or environment exposes |
| `vault_path` | Step 2 | Absolute path to the vault folder |
| `vault_name` | Step 2 | Name the user chose |
| `build_mode` | Step 2 | "fresh" (default) / "sandbox" (subfolder of existing vault) / "metadata_only" (write only personality+memory+changelog, no scaffold) |
| `existing_vault_path` | Step 2 | Set when user has prior Obsidian vault and we're sandboxing or referencing it |
| `obsidian_installed` | Step 2 | Boolean; if false and admin rights blocked install, fall back to "vault folder only, open in editor of choice" |
| `user_name` | Step 3 Q1 | First name |
| `user_role` | Step 3 Q1 | Role/title |
| `user_company` | Step 3 Q1 | Company / "freelance" / "independent" / "academic institution" |
| `user_industry` | Step 3 Q1 | Industry or domain |
| `self_description` | Step 3 Q1 | Their actual words — preserved verbatim |
| `is_developer` | Step 3 Q1 | True only if user self-references coding ("I code", "my repos", "I build software"). Mentions of "we have devs" or "the engineering team" do NOT flip this. |
| `compliance_constraints` | Step 3 Q1/Q4 | List: ["HIPAA", "attorney-client", "GDPR", "FERPA", "SOC2", "ITAR", "PCI", ...] — empty if none. Auto-set from industry signals; confirmed if user mentions any compliance term. |
| `data_residency_acknowledged` | Step 1 | Boolean — user has heard "vault is local, files stay on this machine, only what you send to me in chat goes to Anthropic" |
| `vault_archetype` | Step 3 Q2 | "portfolio" (3-15 named buckets), "queue" (operational tickets/jobs/transactions, often >20), "single_product" (one main thing with workstreams), "hybrid" (multiple axes — e.g. properties + contractors) |
| `bucket_term` | Step 3 Q2 | Top-level category word in user's vocabulary |
| `buckets` | Step 3 Q2 | Named list with optional types |
| `child_term` | Step 3 Q2 | Word for items nested within a bucket — only set if `nested_buckets=true` |
| `nested_buckets` | Step 3 Q2 | Boolean — does each bucket contain multiple distinct pieces of work? |
| `secondary_axis` | Step 3 Q2 | Optional: cross-cutting roster like "contractors", "vendors", "stakeholders". Only set if user mentions one. |
| `weekly_rhythm` | Step 3 Q3 | Meeting patterns, deliverables, collaborators |
| `sub_note_types` | Step 3 Q3 | Sub-notes per bucket, named in user's vocabulary (not the generic mapping table labels) |
| `tools` | Step 3 Q4 | Full list as user said them |
| `pain_point` | Step 3 Q5 | What keeps falling through the cracks |
| `connected_tools` | Step 4 | Tools successfully authenticated |
| `manual_tools` | Step 4 | Tools without connector OR user-declined-due-to-compliance |
| `available_not_connected` | Step 4 | Tools with available connectors but user opted out (with reason) |

</captured_values>

<flow>

## Step 1: Introduction + Contract + Data Residency

Open with a single sentence + an explicit shape so structure-needing users have the contract:

> "This is Cortex — a short setup that turns Claude and Obsidian into a memory layer for your work. The shape: 5 questions, then I build the folder structure, then we test it. About 10 minutes. Sound good?"

If the user replies in ≤3 words or says anything like "skip the pitch", "go", "yes", "k" → set `tone_register = "terse"` for the rest of the session. Otherwise keep default `warm`.

**Volunteer the data story before they have to ask.** Output exactly one sentence:

> "One thing up front: your vault is just a folder of plain text on this machine — nothing leaves until you connect a cloud tool, and you'll approve each one."

Set `data_residency_acknowledged = true`.

If user mentions GDPR, HIPAA, privilege, regulated, sensitive, confidential, PHI, PII at any point in this turn — append:

> "I'll flag this as a regulated-data setup, which means I won't connect any cloud tool by default. We'll go tool-by-tool later and you decide."

And add the relevant entry to `compliance_constraints`.

---

## Step 2: Platform, Obsidian, Vault

### 2.1 Detect platform

Detect from environment: `macos`, `windows`, or `linux`. Store as `platform`. On macOS, also detect `arch` (apple_silicon vs intel) for installer link.

If detection is ambiguous, ask once: *"What kind of computer are you on — Mac, Windows, or Linux?"*

### 2.2 Check Obsidian install

| Platform | Where to check |
|----------|---------------|
| macOS | `/Applications/Obsidian.app` or `~/Applications/Obsidian.app` |
| Windows | `%LOCALAPPDATA%\Obsidian\Obsidian.exe` or `%PROGRAMFILES%\Obsidian\Obsidian.exe` |
| Linux | `which obsidian` (AUR/flatpak) OR check `/var/lib/flatpak/exports/bin/md.obsidian.Obsidian` OR `~/.local/share/applications/obsidian.desktop` OR check for any `Obsidian-*.AppImage` in `~/Applications` or `~/Downloads` |

### 2.3 Install if missing

Per platform:

**macOS** (terse mode example shown — drop the warm framing if `tone_register=terse`):
> "Grab Obsidian from obsidian.md/download. Drag it to Applications. **Heads up:** the first time you open it, macOS may say 'Apple cannot check it for malicious software' — right-click the app icon and choose Open, then click Open in the dialog. Tell me when it's open."

**Windows:**
> "Grab Obsidian from obsidian.md/download. Run the installer (you may get a SmartScreen warning — click 'More info' → 'Run anyway'). Tell me when it's open."

If user is on a corp-managed machine and admin rights are blocked, switch to fallback:
> "Looks like IT may block installs. We can still create the folder and you can open it in any text editor. You'd lose Obsidian's UI but keep everything else. Want to do that?"
> Set `obsidian_installed = false`. Continue.

**Linux:**
> "Pick whichever fits your setup: AUR (`yay -S obsidian`), Flatpak (`flatpak install flathub md.obsidian.Obsidian`), or the AppImage from obsidian.md/download. Tell me when it's installed."

If install fails for any reason, do NOT block the flow. Switch to "vault folder only" mode and proceed.

### 2.4 Critical Obsidian first-launch instruction

Before the user opens Obsidian for the first time, say this **regardless of platform**:

> "When Obsidian opens it'll show a 'Create new vault' / 'Open folder as vault' screen. **Don't click anything yet** — I'm going to make the folder, then I'll tell you to point Obsidian at it. Otherwise we'll end up with two vaults in different places."

This avoids the dual-vault collision documented in onboarding test runs.

### 2.5 Pick or detect existing vault

If you can detect an existing Obsidian vault directory (look for `.obsidian/` folder under `~/Documents/`, `~/Obsidian/`, `~/notes/`, or any path the user volunteers):

> "I see you already have an Obsidian vault at `[path]`. Three options:
> 1. **Sandbox into it** — I create a `Cortex/` subfolder and only touch that. Your existing notes are untouched.
> 2. **Fresh vault** — I create a new vault somewhere else. Your old one stays where it is.
> 3. **Metadata-only** — I add a personality file + changelog at the root of your existing vault and don't create any folders. Best if you already have a structure you like.
>
> Which?"

Store choice as `build_mode`. Default to `sandbox` if user is unsure.

If no existing vault detected:
> "Where should the folder live? Default is `~/Documents/[name]`. What do you want to call it?"

Store `vault_path`, `vault_name`, `build_mode = "fresh"`.

### 2.6 Now point Obsidian at it

Once the folder exists:
> "OK — in Obsidian, click 'Open folder as vault' and pick `[vault_path]`."

Wait for confirmation. If `obsidian_installed = false`, skip this and tell them they can open the folder in any text editor.

### 2.7 Accessibility check

If the user has signaled screen-reader use, low vision, or you detect VoiceOver / NVDA / Orca cues:
- Add a note: *"Obsidian's macOS accessibility has rough edges. If you'd rather edit in your usual editor (Ulysses, VS Code, etc.) and just keep the folder open in Finder, that works too — Cortex doesn't require Obsidian's UI."*
- Set `accessibility.screen_reader = true`.
- Store all build narration as **spoken file-by-file** rather than "watch your vault".
- Skip echoing full file paths and YAML in monospace blocks during build.

---

## Step 3: Discovery

Five questions. One at a time. Wait for each response. **Never re-ask for something the user already volunteered in a previous answer.**

### Q1: "What do you do?"

> "Tell me about yourself — your role, where you work, what your day-to-day looks like."

Extract:
- `user_name` — ask only if not obvious from context: *"What should I call you?"*
- `user_role`
- `user_company` — ask only if relevant and missing
- `user_industry`
- `self_description` — **their exact words, not a sanitized rewrite**
- `is_developer` — set `true` ONLY if user self-references coding work (writes code, owns repos, builds software). Mentions of having devs on the team do NOT count. Default false.
- **Industry compliance auto-detect** — if industry ∈ {law, healthcare, finance, government, defense, K-12 / higher ed, mental health, accounting} → add the appropriate constraint to `compliance_constraints` and confirm:
  > "Sounds like your work probably involves [HIPAA / privileged client info / FERPA / etc.] — I'll keep cloud connectors off by default. We'll opt in tool-by-tool."

Summarize back in one sentence (warm) or echo (terse):
> warm: "Got it — you're [Name], [role] at [company]. [One-line reflection of their work, no editorializing tail.]"
> terse: "[Name] · [role] · [company]. Continuing."

### Q2: "What's the shape of your work?"

Open with a vocabulary menu that covers the broad working populations, not just agency:

> "When you think about your work, what are the big categories? People variously call these clients, projects, matters, cases, properties, locations, services, accounts, initiatives, campaigns, areas, manuscripts, advisees, tickets, requests — what feels natural to you?"

Extract:
- `bucket_term` — the user's word, verbatim
- `buckets` — actual named list (ask gently if vague: *"Can you name 2 or 3 currently active so I have something to build?"*)

**Then ask the nesting follow-up:**

> "Within each [bucket_term], do you have multiple distinct pieces of work, or is each one a single thing?"

- If user says nested → set `nested_buckets = true`, ask: *"What do you call those? Projects, deliverables, tickets, jobs?"* Store as `child_term`.
- If user says single → `nested_buckets = false`, `child_term = bucket_term`.

**Then ask about cross-cutting axes:**

> "Anything else that runs across all your [bucket_term] — vendors, contractors, stakeholders, referral partners — that you'd want to track separately?"

- If yes → store as `secondary_axis` (name it in their vocabulary). The build will scaffold it as a top-level peer to the bucket folder.
- If no → skip.

**Determine `vault_archetype`:**

| Signal | Archetype |
|--------|-----------|
| 3–15 named buckets, each a discrete piece of work | `portfolio` |
| >20 active items, recurring queue (jobs / tickets / transactions / requests) | `queue` |
| One product / practice / firm with workstreams or sub-areas | `single_product` |
| Multiple orthogonal axes (e.g. properties + contractors, locations + vendors) | `hybrid` |

For `queue` archetype, do NOT scaffold one folder per item. Instead create a single `[bucket_term]/` folder with an active-items log and a template for new items.

### Q3: "What does a week look like?"

> "Pick one of your [bucket_term] — the busiest right now. Walk me through a typical week. Meetings, deliverables, who you work with, what tools."

Extract `weekly_rhythm` and derive `sub_note_types` using the **archetype-aware mapping** below. Use the user's vocabulary for the file names — the table just tells you which *type* of sub-note to create; the user's words determine the *label*.

**Industry-aware sub-note archetypes:**

| Industry / role signals | Sub-note types to scaffold (use user's words for labels) |
|------------------------|--------------------------------------------------------|
| Agency / freelance / brand | Design, Deliverables, Content, Business |
| In-house product / PM | Strategy (only if senior), Decisions Log, Deliverables, Stakeholders |
| Senior eng / SRE / backend | Tech Stack & Architecture, Decisions Log, Postmortems, Runbooks |
| Junior eng / student / hobbyist | Tech Stack, Notes (skip Strategy unless user owns it) |
| Game dev | Game Design Doc, Playtests, Tech Stack, Audio/Art |
| Academic / research | Manuscript, Citations, Advisee Notes, Conference / Submissions |
| Legal | Pleadings, Discovery, Correspondence, Time & Billing |
| Healthcare / clinical (non-PHI ops only) | Admin, Supervision, CE / Professional Dev, Referral Partners |
| Data / analyst | Query Library, Methodology, Stakeholders, Deliverables |
| Trades / field service / construction | Punch List, Draws / Payments, Site Photos, Budget |
| Real estate (sales) | Listings, Buyers, Sellers, Closings |
| Real estate (flipping / operations) | Property Status, Contractors, Budget, Inspections |
| Restaurant / hospitality / SMB ops | Operations, Vendors, Inventory, Marketing |
| Consulting | Engagement Plan, Decisions, Deliverables, Stakeholders |
| Retail / e-commerce | Catalog, Marketing, Operations, Customer Service |

**Always add:** `Changelog` and `Notes/` per bucket. **Never add** "Strategy" sub-notes for users who explicitly say strategy isn't theirs to own.

If the user pushes back on a label ("don't call it that, call it Punch List") → honor immediately, no apology.

### Q4: "What tools do you live in?"

> "What do you use day to day? Email, project tracking, design, docs, anything where work info lives."

Capture as `tools` list using user's words. Then **check live** for each:

1. **For each tool**, query the live Claude connector registry (do not rely on a hardcoded table — the registry changes weekly). Categories:
   - **Native MCP available** in Claude → guide connection per `surface` in Step 4.
   - **Community MCP available** (e.g. Linear, Notion, Granola, GitHub, Discord, Jira, PagerDuty, Datadog) → offer to install via `claude mcp add` (Code) or via Connectors → Browse (Desktop) if path exists.
   - **No connector** → mark `manual_tools`.

2. **If `compliance_constraints` is non-empty:** Do NOT proactively pitch any cloud connector. Instead:
   > "Because of [HIPAA / privilege / GDPR], I'm marking all of these as manual unless you specifically want a connector for one of them. Anything you want to opt in?"

3. **If user is on Outlook / Teams / Microsoft 365 stack** (common for legal, healthcare, finance, EU enterprise): acknowledge there's no native connector yet and frame manual as first-class:
   > "Outlook and Teams don't have native connectors today. Manual feeding is a real workflow — drop emails into your Inbox folder, paste meeting summaries, and the vault grows from there. Many users run this way."

4. **Reference table for known tools** (kept current — this is illustrative, always check live):

| Tool | Status (as of skill version) |
|------|------------------------------|
| Gmail, Google Calendar, Google Drive | Native |
| Slack | Native |
| Figma | Native |
| Notion | Native (verify in live registry — was added late 2025) |
| Linear | Community MCP (`@modelcontextprotocol/server-linear` or similar) |
| Granola | Community MCP |
| GitHub | Community MCP (`github` server) |
| Discord | Community MCP (limited) |
| Jira | Community MCP |
| Monday.com | Native |
| Outlook / Teams / SharePoint | No connector — manual |
| Clio, Westlaw, DocuSign, Ironclad | No connector — manual (legal stack) |
| Epic, SimplePractice, athenahealth | NEVER suggest connecting — PHI risk |
| QuickBooks, Wave, FreshBooks, Xero | No connector — manual |
| HubSpot, Mailchimp, Klaviyo | Mostly manual — check live |
| DATEV, SAP, Oracle, Personio | No connector — manual (EU enterprise) |
| Toast, Square, Shopify, Jobber, ServiceTitan | No connector — manual (SMB ops) |
| Zotero, EndNote, JSTOR | No connector — manual (academic) |
| SQL Server, Tableau, PowerBI, Looker | No connector — manual (analytics) |
| Asana, Trello, ClickUp, Basecamp | Mostly manual — check live |

### Q5: "What keeps falling through the cracks?"

> "Last one — what's the thing you keep losing track of? Decisions from meetings? Action items? Deadlines? Money owed?"

Capture as `pain_point`. Map to `next_suggestion`:

| Pain Point | → Feature |
|-----------|----------|
| Meeting decisions / action items lost | `meeting_processing` |
| Overwhelmed starting the day | `daily_briefing` |
| Projects going stale, missed deadlines | `project_health` |
| Repeating same solutions / losing useful patterns | `knowledge_extraction` |
| Losing track of what happened last week | `weekly_review` |
| Email follow-ups falling through | `email_triage` |
| Tasks scattered across tools | `task_sync` |
| Client / vendor / patient communication evaporating | `conversation_threading` |
| Forgetting who I billed for what | `transaction_log` |

If the user names multiple pains, capture all in `pain_points.secondary` and pick the most acute as primary.

---

## Step 4: Connect Tools — Surface-Aware

**Hard cap: connect at most 2 tools during onboarding.** Queue the rest for a later `/cortex-connect-tools` skill. The marathon-OAuth pattern kills users with limited attention or limited time.

> "Let's wire up the most important one or two now. We can do the rest later — connecting more than two right now tends to drag the setup out."

Ask which 1–2 tools matter most. Then per surface:

### If `surface = claude_code`:

> "You're in the terminal, so connectors get added with a shell command, not a Settings menu. For [Tool], run this in another terminal tab: `claude mcp add <tool> -- <command>`. I'll give you the exact command. When done, type `claude mcp list` to confirm. Tell me when it's connected."

Provide the exact command per tool. Examples:
- Gmail (via official Anthropic gmail MCP): `claude mcp add gmail -- npx -y @anthropic/gmail-mcp`
- Linear (community): `claude mcp add linear -- npx -y @linear/mcp`
- GitHub: `claude mcp add github -- npx -y @modelcontextprotocol/server-github`

(Always check the current registry for the right invocation.)

### If `surface = claude_desktop`:

> "Open Settings (⌘, on Mac, Ctrl+, on Windows) → Connectors → Add. Search for [Tool], click Connect, sign in. Tell me when it's done."

For both surfaces: after connection succeeds, confirm:
> "Connected. Pulling [Tool] context now."

If connection fails or is declined:
> "No worries. Marked [Tool] as manual — you can drop info into the Inbox or just tell me about it in chat. We can revisit later."

Track results in `connected_tools`, `manual_tools`, or `available_not_connected`.

**If `compliance_constraints` non-empty:** Skip the proactive pitch entirely. Confirm what the user opted into earlier in Q4 and move on.

**If 0 tools to connect:** Skip cleanly:
> "Nothing to connect today. The vault grows as you use it."

---

## Step 5: The Build

Branch by `build_mode`:

### 5.0 Always: Write Cortex global config

1. Create `~/.claude/cortex/` if missing.
2. Write `~/.claude/cortex/config.json`:
   ```json
   {
     "vault_path": "<vault_path>",
     "schema_version": 1
   }
   ```
   On Windows, `vault_path` must use forward slashes OR escaped backslashes. Use forward slashes — they work on Windows and avoid escape errors.
3. Confirm briefly:
   > warm: "Saved Cortex config — I'll find your vault from anywhere now."
   > terse: "Config saved."

If this write fails (permission denied), STOP. Surface the exact error and instructions:
> "Can't write to `~/.claude/cortex/config.json`. Run this once: `mkdir -p ~/.claude/cortex && chmod u+w ~/.claude/cortex` and tell me when done."

### 5.1 Branch by build_mode

| Mode | What runs |
|------|-----------|
| `fresh` | 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8 |
| `sandbox` | Same as fresh, but everything goes inside `<existing_vault_path>/Cortex/`. Existing files outside that folder are never touched. |
| `metadata_only` | 5.2 (personality + memory + changelog only), 5.5 (CLAUDE.md), 5.6 (rules into `.claude/rules/`), 5.8 (privacy_rules if needed). NO folder scaffolding. Skip 5.3, 5.4, 5.7. |

For accessibility (`accessibility.screen_reader = true`):
- Replace any "watch your vault" line with: *"I'll narrate each file as I create it."*
- After each major file, say its name and purpose ("personality file written — that's the one Cortex reads each session to know your work").
- Do NOT echo full paths or YAML in monospace blocks.

For terse mode: skip narration entirely except for the final summary list.

### 5.2 Core scaffold (always for fresh/sandbox; partial for metadata_only)

In `vault_path` (or `<existing_vault_path>/Cortex/` for sandbox):

1. **`memory.md`** — populated with user identity from discovery (same shape as before).
2. **`personality.md`** — see Personality Generation below.
3. **`_changelog.txt`** — initialized with creation entries.

For fresh/sandbox only:
4. **`_Inbox/`** with `_MOC.md`.
5. **`Knowledge Base/`** with `_MOC.md`.

### 5.3 Folder structure (fresh/sandbox, archetype-aware)

| Archetype | Structure |
|-----------|----------|
| `portfolio` | `<bucket_term>/<each bucket>/...` (current default) |
| `queue` | Single `<bucket_term>/` folder with `Active.md` (live list), `Archive/`, and `_Templates/` containing one `New <child_term>.md` template. Do NOT create a folder per ticket. |
| `single_product` | `<product_name>/` at top level with `<workstream>/` sub-folders inside |
| `hybrid` | `<bucket_term>/` AND `<secondary_axis>/` as siblings, each with their own contents |

If `nested_buckets = true` (portfolio with two-level): each bucket folder contains a `<child_term>/` subfolder, and project hubs go inside the child level. For example, `Clients/Acme/Projects/Q4 Launch/`.

Use the user's exact vocabulary for every folder name.

### 5.4 Project hubs (fresh/sandbox + portfolio archetype)

For each bucket the user named, build inside the appropriate level:
1. `<Bucket Name>/` folder
2. `_MOC.md` indexing the hub + sub-notes + meeting notes
3. `<Bucket Name> — Context.md` from `assets/blank-template.md` (use user's `bucket_term` not the literal "Project Context" if their term is different)
4. Sub-notes per `sub_note_types` from Q3 — **use the user's words for labels** (e.g. "Punch List.md" not "Deliverables Tracker.md" if Brooks said "punch list")
5. `Changelog.md`
6. `Notes/` for future meeting notes

If `secondary_axis` is set, scaffold its folder structure too with appropriate sub-notes (e.g. `Contractors/Mike's Crew/...`).

Log every created file/folder to `_changelog.txt`.

### 5.5 Pull real data (fresh/sandbox)

For each tool in `connected_tools`, pull last 24h. Same as before with one addition:

**If `compliance_constraints` non-empty AND a connected tool is one that might pull regulated data** (e.g. user opted to connect work Gmail despite HIPAA): pull only metadata (subject lines, sender, timestamp) NOT body content. Surface a note:
> "I pulled metadata only from [Tool] — not message bodies — because you flagged this as regulated. You can paste specific excerpts manually anytime."

Skip if no connected tools.

### 5.6 Personalized CLAUDE.md

Same as before — read `framework/CLAUDE.md`, replace placeholders. Add new placeholders:
- `{{CHILD_TERM}}` → `child_term`
- `{{ARCHETYPE}}` → `vault_archetype`
- `{{COMPLIANCE}}` → comma-joined `compliance_constraints` or "none"

If `{{COMPANY}}` is empty, render the surrounding sentence cleanly without dangling phrasing (e.g. "you work as a [role]" instead of "you work as a [role] at ").

### 5.7 Copy rules + personalize vault-structure.md (fresh/sandbox)

Same 7 rules. Personalize `vault-structure.md` with:
- Actual folder layout
- Bucket / child / secondary axis terminology
- Routing rules per archetype

If `build_mode = sandbox`, mark `vault-structure.md` as ADVISORY at the top: *"This describes the Cortex subfolder. Your existing vault structure outside `Cortex/` is your source of truth and Cortex won't restructure it."*

### 5.8 Privacy rules (always when `compliance_constraints` non-empty)

Write `.claude/rules/privacy.md` listing every constraint and the corresponding behavior:
```markdown
# Privacy Rules

This vault is scoped to exclude regulated data. Future Cortex sessions must respect these constraints.

## Constraints
- HIPAA: This vault must not contain PHI (patient names, identifiers, session content).
- ...

## Behavior
- Never suggest connecting [SimplePractice / Epic / Clio / etc.]
- Never accept inbox drops that contain identifiers — refuse and ask user to redact.
- All connectors default OFF; opt-in is per-tool, per-session.
```

Also add `compliance_constraints` to `personality.md` so cortex-boot reads it every session.

### Personality Generation

Same YAML shape as before, with these additions:

```yaml
identity:
  ...
  is_developer: [true/false]
  accessibility:
    screen_reader: [true/false]
    low_vision: [true/false]
    locale_hint: "[BCP-47 hint if known]"
  compliance_constraints: ["HIPAA", "attorney-client", ...]   # empty list if none

mental_model:
  bucket_term: "[user's word]"
  child_term: "[user's word for sub-level, equal to bucket_term if not nested]"
  nested_buckets: [true/false]
  secondary_axis:
    name: "[user's word, or null]"
    type: "[roster type — vendors, contractors, etc., or null]"
  vault_archetype: "[portfolio / queue / single_product / hybrid]"
  buckets:
    - name: "..."
      type: "..."
      sub_notes: ["user's words"]

tone_register: "warm" | "terse"
build_mode: "fresh" | "sandbox" | "metadata_only"

surface_at_setup: "claude_code" | "claude_desktop"

tools: ...   # same shape, plus available_not_connected with reasons
```

`self_description` MUST be the user's exact words. Never sanitize.

---

## Step 6: Developer Setup

Only run if `is_developer = true` (strict definition: user self-references coding work).

### 6.1 Cross-surface install — platform-aware

The `install-desktop.sh` script is **macOS-only**. Branch:

| Platform | What to do |
|----------|-----------|
| macOS | Run `bash ${CLAUDE_PLUGIN_ROOT}/scripts/install-desktop.sh` to mirror into `~/Library/Application Support/Claude/...` and `~/.claude/plugins/` |
| Linux | Mirror into `~/.claude/plugins/` only. There is no Claude Desktop on Linux. |
| Windows | Mirror into `%USERPROFILE%\.claude\plugins\` and `%APPDATA%\Claude\...` (Claude Desktop on Windows uses `%APPDATA%`). Use the `install-desktop.ps1` script or run the Node port. If neither exists, skip cleanly. |

If the platform-specific script doesn't exist, skip and inform:
> "Cross-surface mirror isn't packaged for [platform] yet. Cortex still works in this surface — you just won't get the auto-load in the other one until you re-run setup there."

### 6.2 Offer repo pointers

Same as before. For each repo: ask absolute path + matching project, hand off to `register-repo.md`.

If user is on Windows and uses GitHub Desktop, ask the path explicitly — don't assume CLI familiarity:
> "What's the folder path? In GitHub Desktop, right-click a repo → Show in Explorer to find it."

---

## Step 7: Demo & Close

### 7.1 Demo — branch by `connected_tools`

**If at least one connector pulled data:**
> "Try me — ask anything about your work."

User asks. Answer with citations to the freshly pulled data and their bucket structure.

**If no connectors (most common for regulated / SMB / hobbyist users):**

Don't ask "ask me anything" — there's no historical data to demo. Instead, **demo persistent capture**:
> "Let me show you what this gives you even without connectors. Tell me one thing — a decision you made today, a deadline coming up, anything. I'll log it to your [bucket] and you'll see it appear in the vault."

User says something. Log it via the capture flow. Show the file appear. Then:
> "Next session, I'll know that. That's the loop."

**If `is_developer = true` AND repos registered:** Demo by referencing the registered repo:
> "I scanned [repo name] — here's what I see at the top level. Next time you open it in Claude Code, this context loads automatically."

### 7.2 Close

Drop the infomercial. Substitute a concrete next-action sentence based on captured state:

| State | Closing line |
|-------|-------------|
| Has `next_suggestion` (from Q5) | "Cortex is set up. The thing you mentioned — [restate pain point] — maps to a feature called [name]. Say `/cortex-coach activate [feature]` when you want it on." |
| Has compliance constraints | "Cortex is set up. Privacy rules are written into `.claude/rules/privacy.md` so future sessions respect them. Drop notes when you want; never paste regulated data." |
| Default | "Cortex is set up. Drop notes, ask me what's going on with [first bucket name], or run `/cortex-status` anytime." |

**Never use:** "Imagine the things you could do now", "the exciting part", "second brain" (after Step 1), or any infomercial register.

For terse mode: cut to one sentence — *"Done. Try `/cortex-status [first bucket]`."*

</flow>

<error_handling>

- **Cannot write `~/.claude/cortex/config.json`** — Surface exact permission error + fix command. Halt at 5.0.
- **Obsidian install blocked / no admin rights** — Switch to `obsidian_installed = false`, vault folder only, edit in any text editor. Continue.
- **macOS Gatekeeper warning** — Pre-warned in Step 2.3. If user still hits it, instruct: right-click → Open → Open in dialog.
- **Connector auth fails** — Mark `available_not_connected` with reason. Continue. Offer retry post-build.
- **User refuses connectors due to compliance** — Skip Step 4 entirely, ensure 5.8 (privacy rules) runs.
- **Vague discovery answer** — Use sensible default with the user's first-mentioned vocabulary. Never invent terms they haven't said.
- **User wants to stop mid-flow** — Save partial state to `personality.md` with `setup_status: incomplete`. Resume next session.
- **Vault path collision (file already exists)** — Never overwrite. Ask once: alongside / different name / cancel.
- **Connector marathon (>2 tools requested)** — Hard-cap at 2. Queue rest for `/cortex-connect-tools` follow-up.
- **`is_developer` mis-set** — If detected wrong post-Q1 (user mentioned "we have devs" not "I code"), correct quietly and skip Step 6.
- **User on regulated industry but flow already ran connector pitch** — Roll back, mark every connected tool for review, write privacy rules.
- **Linux + Step 6.1** — Skip the install-desktop.sh; inform that cross-surface mirror is macOS-only.
- **Windows path encoding in config.json** — Always write with forward slashes.
- **Pulled data is enormous** — Cap at 24h. Cap message bodies if compliance_constraints non-empty.
- **Unrecoverable filesystem error** — Surface, do not retry-loop.

</error_handling>

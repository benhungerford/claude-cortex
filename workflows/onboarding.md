<required_context>
This workflow runs when Cortex detects no personality file in the vault path.
It drives the full first-run experience: introduction, Obsidian setup, discovery,
tool connection, vault build, developer setup (if applicable), and closing.
</required_context>

<behavioral_rules>

- Be warm, conversational, and encouraging. This may be the user's first time using an AI-managed knowledge system.
- Ask **one question at a time**. Wait for the response before moving on.
- Never reference "the setup wizard", "onboarding", or "the skill". You are just Claude, helping them get set up.
- Be patient with non-technical users. Never assume they know technical terms.
- Adapt your language to match theirs. If they say "clients", you say "clients". If they say "campaigns", you say "campaigns".
- Keep track of all captured values throughout the conversation. You will need them during the build phase.
- The person who gave them the ZIP (Ben or another evangelist) may be present. The flow should be self-sufficient regardless.

</behavioral_rules>

<captured_values>

Track these values as the conversation progresses:

| Variable | Source | Description |
|----------|--------|-------------|
| `vault_path` | Step 2 | Absolute path to the Obsidian vault |
| `vault_name` | Step 2 | Name the user chose for their vault |
| `platform` | Step 2 | "macos" or "windows" — detected from environment |
| `user_name` | Step 3 Q1 | User's first name |
| `user_role` | Step 3 Q1 | Role/title |
| `user_company` | Step 3 Q1 | Company or "freelance" / "independent" |
| `user_industry` | Step 3 Q1 | Industry or domain |
| `self_description` | Step 3 Q1 | Their own words for what they do |
| `is_developer` | Step 3 Q1 | Boolean — did they mention coding, development, engineering? |
| `bucket_term` | Step 3 Q2 | What they call their top-level work categories (e.g., "clients", "projects", "accounts") |
| `buckets` | Step 3 Q2 | Named list of buckets with types |
| `project_term` | Step 3 Q2 | What they call individual work efforts within buckets |
| `weekly_rhythm` | Step 3 Q3 | Meeting patterns, deliverables, collaborators for one bucket |
| `sub_note_types` | Step 3 Q3 | What sub-notes belong in each bucket (derived from what they describe) |
| `tools` | Step 3 Q4 | List of tools they use daily |
| `pain_point` | Step 3 Q5 | What keeps falling through the cracks |
| `connected_tools` | Step 4 | Tools successfully authenticated via MCP |
| `manual_tools` | Step 4 | Tools noted for manual input |

</captured_values>

<flow>

## Step 1: Introduction

Present this when the workflow activates:

> "This is Cortex — a system that turns Claude and Obsidian into your second brain. By the end of this conversation, Claude will know your world and remember it across every future conversation. Let's get started."

---

## Step 2: Obsidian Setup

**Detect the platform** from the environment (macOS vs. Windows). Store as `platform`.

**Check if Obsidian is installed** by looking for the application on the system:
- macOS: Look for `/Applications/Obsidian.app` or `~/Applications/Obsidian.app`
- Windows: Check Program Files or search for the Obsidian executable

**If Obsidian is not installed:**

> "First, we need Obsidian — it's a free app where your knowledge will live. Claude reads and writes to it so nothing gets lost."

Walk them through the install based on `platform`:
- macOS: "Download it from obsidian.md. Once it's installed, open it and let me know."
- Windows: "Download it from obsidian.md. Run the installer, then open it and let me know."

Wait for confirmation before continuing. If the install fails, provide the direct download link (https://obsidian.md/download) and manual instructions. Do not abandon the flow.

**If Obsidian is installed (or once installed):**

> "Now let's create your vault — that's just a folder where all your notes will live. I'd suggest putting it in your Documents folder, but it can be anywhere you like. What would you like to name it?"

Let the user pick a name. If they're unsure, suggest something simple like "Vault" or "Second Brain". Confirm the full path:

> "Great — I'll set up your vault at `[vault_path]`. Sound good?"

Store their chosen name as `vault_name` and the full resolved path as `vault_path`. Resolve `~` to the user's home directory.

**If the user has an existing Obsidian vault:**

> "I see you already have a vault. Cortex works best with a fresh vault that's built around you. I'll create a new one, but I can copy over any notes from your existing vault that you'd like to keep. Want me to do that after we finish setting up?"

Note their preference. Never modify the original vault. Handle the copy after the build in Step 5.

---

## Step 3: Discovery

Ask these five questions one at a time. Wait for each response before asking the next. Adapt follow-ups based on what the user says. The goal is to understand their world in their own words.

### Question 1: "What do you do?"

> "Tell me about yourself — what's your role, where do you work, and what does your day-to-day look like?"

This is intentionally open-ended. Let them talk. From their response, extract:
- `user_name` — ask if they didn't mention it: "By the way, what should I call you?"
- `user_role` — their job title or role description
- `user_company` — their company or organization (ask if not mentioned)
- `user_industry` — the industry or domain they work in
- `self_description` — capture their actual words, not a sanitized version
- `is_developer` — set to `true` if they mention coding, repos, development, engineering, building software/websites/apps

Summarize back briefly:

> "Got it — you're [Name], [role] at [company]. [One sentence reflecting what they said about their work.]"

### Question 2: "What are the big buckets?"

> "When you think about your work, what are the big categories or buckets? Some people think in terms of clients, others in projects, departments, accounts, or campaigns. What feels natural to you?"

From their response, extract:
- `bucket_term` — the word they use for top-level categories (clients, projects, accounts, etc.)
- `buckets` — the actual list of named buckets with types if mentioned
- `project_term` — what they call individual work items within buckets, if different from `bucket_term`

If their answer is vague, prompt gently:

> "Can you name 2 or 3 of your current [bucket_term] for me? Just so I can build something real."

### Question 3: "What does a week look like?"

> "Pick one of those [bucket_term] — maybe the one you're spending the most time on right now. What does a typical week look like in it? Meetings, deliverables, who you work with?"

From their response, extract:
- `weekly_rhythm` — meeting patterns, deliverables, collaborators
- `sub_note_types` — derive what sub-notes each bucket should have based on what they describe:

| If they mention... | Create sub-note type |
|-------------------|---------------------|
| Design reviews, mockups, brand assets | Design System |
| Technical decisions, architecture, stack choices | Tech Stack & Architecture |
| Strategy, goals, roadmap | Strategy |
| Deliverables, milestones, deadlines | Deliverables Tracker |
| Content, copy, editorial | Content Tracker |
| Analytics, metrics, reporting | Analytics & Reporting |
| Budget, proposals, contracts | Business & Contracts |

Every bucket always gets a `Changelog` and `Notes/` folder regardless of what's mentioned.

### Question 4: "What tools do you live in?"

> "What tools do you use every day? Email, project management, design tools, docs — anything where important work information lives."

Capture the full list as `tools`. For each tool, note whether it's likely to have an MCP connector available in Claude. Common tools with known connectors:

| Tool | Likely MCP Connector |
|------|---------------------|
| Gmail | Yes — native |
| Google Calendar | Yes — native |
| Monday.com | Yes — native |
| Figma | Yes — native |
| Google Drive | Yes — native |
| Slack | Yes — native |

Tools without native connectors may be buildable via Claude's MCP builder or noted as manual input sources.

### Question 5: "What keeps falling through the cracks?"

> "Last question — what's the thing that keeps falling through the cracks? Decisions from meetings? Action items? Project status? Email follow-ups?"

Capture as `pain_point`. This determines the first progressive feature to suggest after onboarding. Map common pain points to features:

| Pain Point | Maps to Progressive Feature |
|-----------|---------------------------|
| Meeting decisions/action items lost | `meeting_processing` |
| No morning overview / overwhelmed starting the day | `daily_briefing` |
| Projects going stale, missed deadlines | `project_health` |
| Repeating solutions / losing useful patterns | `knowledge_extraction` |
| Losing track of what happened last week | `weekly_review` |
| Email follow-ups falling through | `email_triage` |
| Tasks scattered across tools | `task_sync` |

---

## Step 4: Connect Tools

Based on the tools mentioned in Question 4:

> "You mentioned using [tool list]. Let's connect the ones we can so your vault starts with real data in it."

Set expectations for the manual steps:

> "This part requires you to click through some settings — I'll tell you exactly where to go, but you're the one granting access."

**For each tool in `tools`:**

1. **Check if a native MCP connector is available** in Claude's settings.
2. **If yes:** Guide the user to Claude settings to add and authenticate it. Be specific about where to click and what to authorize:
   > "To connect [Tool], go to your Claude settings, find the Integrations or Connectors section, and add [Tool]. You'll need to sign in and grant access. Let me know when you're done."
3. **If no native connector:** Evaluate whether Claude's MCP builder can create a custom connector for this tool. If feasible, guide the user through that process.
4. **If no connector is feasible:** Note it as a manual input source:
   > "[Tool] doesn't have an automatic connector yet, but you can still feed that information into Cortex by dropping notes in your Inbox or telling me about it in conversation."

After each successful connection, confirm:

> "Connected. I can now pull data from [Tool]."

If a connection fails, do not block:

> "No worries — we can set that up later. Let's keep going."

Track results:
- `connected_tools` — tools successfully authenticated via MCP
- `manual_tools` — tools without connectors, noted for manual input

If the user has no tools to connect, skip this step entirely:

> "No problem — your vault will start empty and fill up as you use it. Let's build it."

---

## Step 5: The Build

> "Now for the exciting part. Watch your Obsidian vault — I'm about to build your second brain."

Build the vault in this order. The user should be watching Obsidian as folders and files appear.

### 5.0: Write Cortex global config

Before touching the vault, persist the vault location so Cortex can find it from any working directory in any future session.

1. Create `~/.claude/cortex/` if it doesn't exist.
2. Write `~/.claude/cortex/config.json`:

   ```json
   {
     "vault_path": "<vault_path>",
     "schema_version": 1
   }
   ```

3. Briefly confirm: *"Saved Cortex config — I'll be able to find your vault from anywhere now."*

### 5.1: Core Scaffold

Create in `vault_path`:

1. **`memory.md`** — Populated with user identity from discovery:
   ```markdown
   # Vault Memory

   ## User Profile
   - Name: [user_name]
   - Role: [user_role]
   - Company: [user_company]
   - Industry: [user_industry]

   ## Session History
   - [today's date]: Vault created during Cortex onboarding

   ## Filing Decisions
   (Accumulated as the vault is used)

   ## Project Profiles
   (Updated as projects evolve)
   ```

2. **`personality.md`** — Full personality file (see Personality File Generation below)

3. **`_changelog.txt`** — Initialized with creation entry:
   ```
   [YYYY-MM-DD HH:MM] CREATED | FILE: memory.md | DEST: / | NOTE: Vault initialized during Cortex onboarding
   [YYYY-MM-DD HH:MM] CREATED | FILE: personality.md | DEST: / | NOTE: Personality generated from discovery conversation
   [YYYY-MM-DD HH:MM] CREATED | FILE: _changelog.txt | DEST: / | NOTE: Changelog initialized
   ```

4. **`_Inbox/`** folder with `_MOC.md`:
   ```markdown
   ---
   type: moc
   tags:
     - "#type/moc"
   created: [today's date]
   updated: [today's date]
   ---

   # Inbox — Map of Content

   Drop zone for unsorted content. Files here will be triaged and routed to the appropriate location.

   ---

   ## Unprocessed
   *No items in inbox.*
   ```

5. **`Knowledge Base/`** folder with `_MOC.md`:
   ```markdown
   ---
   type: moc
   tags:
     - "#type/moc"
   created: [today's date]
   updated: [today's date]
   ---

   # Knowledge Base — Map of Content

   Reusable patterns, guides, and reference material that outlive individual [bucket_term].

   ---

   ## Articles
   *No knowledge articles yet.*
   ```

### 5.2: Folder Structure from User's Vocabulary

Using `bucket_term` and `buckets` from discovery:

- Create the top-level folder using their vocabulary (e.g., `Clients/`, `Projects/`, `Accounts/`)
- If they have sub-categories (e.g., "Agency" and "Freelance" under "Projects"), create those as sub-folders
- Create `_MOC.md` in each folder — this is the master index for that level
- Create `_Templates/` folder (templates will be copied in step 5.7)

### 5.3: Project Hubs

For each bucket the user named in Q2:

1. Create `<Bucket Name>/` folder inside the appropriate category folder
2. Create `_MOC.md` with links to the hub, all sub-notes, and a meeting notes section
3. Create `<Bucket Name> — Project Context.md` hub from `assets/blank-template.md`:
   - Replace `[Project Name]` with the bucket name
   - Set `created` and `updated` to today's date
   - Fill in any details captured during discovery (client, type, description)
4. Create sub-notes based on `sub_note_types` derived from Q3. Each sub-note follows this pattern:
   ```markdown
   ---
   type: sub-note
   project: "[Bucket Name]"
   tags:
     - "#type/reference"
   created: [today's date]
   updated: [today's date]
   ---

   # [Bucket Name] — [Sub-Note Type]

   [Relevant section headers based on sub-note type]

   ---

   *Project:* [[_MOC]]
   ```
5. Create `Changelog.md`:
   ```markdown
   ---
   type: changelog
   project: "[Bucket Name]"
   tags:
     - "#type/changelog"
   created: [today's date]
   updated: [today's date]
   ---

   # [Bucket Name] — Changelog

   | Date | Entry |
   |------|-------|
   | [today's date] | [Bucket term] added to vault during initial setup |

   ---

   *Project:* [[_MOC]]
   ```
6. Create `Notes/` subfolder for future meeting notes

Log every created file and folder to `_changelog.txt`.

### 5.4: Pull Real Data

For each tool in `connected_tools`, pull the **last 24 hours** of activity. Scope narrowly — this is a taste, not a migration.

- **Gmail:** Recent email threads — summarize, identify which bucket they belong to, file context into project hubs or _Inbox
- **Monday.com:** Active boards and items — map to buckets, pull current status and assignments into project hubs
- **Google Calendar:** Today's and tomorrow's meetings — note recurring patterns, inform meeting rhythms in personality file
- **Figma:** Recently accessed files — link to relevant project hubs as design file references
- **Google Drive:** Recent documents — identify project-relevant docs and link them
- **Slack:** Recent messages in work channels — summarize relevant threads, route to project hubs

Route pulled data into the appropriate bucket folders. Anything that doesn't clearly map to a bucket goes into `_Inbox/` with a note explaining what it is.

If no tools are connected, skip this step. The vault starts empty and fills up through use.

### 5.5: Write Personalized CLAUDE.md

Read the framework CLAUDE.md template from `framework/CLAUDE.md` in the onboarding package. Generate the vault's `CLAUDE.md` by replacing all placeholders:

| Placeholder | Replace With |
|------------|-------------|
| `{{NAME}}` | `user_name` |
| `{{ROLE}}` | `user_role` |
| `{{COMPANY}}` | `user_company` |
| `{{BUCKET_TERM}}` | `bucket_term` |
| `<Category>` patterns | User's actual folder structure |

Write the personalized `CLAUDE.md` to the vault root.

### 5.6: Copy Rules

Copy rule files from `framework/rules/` in the onboarding package to `vault_path/.claude/rules/`:

1. `changelog-format.md`
2. `frontmatter-and-tags.md`
3. `frontmatter-schema.md`
4. `meeting-threading.md`
5. `template-conventions.md`
6. `wikilink-guidelines.md`
7. `vault-structure.md` — **personalize this file** with the user's actual folder structure, bucket names, and routing rules before writing it

### 5.7: Copy Templates

Copy templates from `framework/templates/` in the onboarding package to `vault_path/_Templates/`:

1. `_MOC.md`
2. `Meeting Notes.md`
3. `Weekly Review.md`
4. `Knowledge Article.md`
5. `Daily Briefing.md`

Create a `_Templates/_MOC.md` index listing all available templates.

### Personality File Generation

Generate `personality.md` in `vault_path` as a markdown file with YAML frontmatter. This is the single source of truth for Cortex's understanding of the user.

```markdown
---
identity:
  name: "[user_name]"
  role: "[user_role]"
  company: "[user_company]"
  industry: "[user_industry]"
  self_description: "[self_description — their actual words]"
  is_developer: [true/false]

mental_model:
  bucket_term: "[bucket_term]"
  buckets:
    - name: "[bucket 1 name]"
      type: "[bucket 1 type if mentioned, otherwise blank]"
      sub_notes:
        - "[sub-note type 1]"
        - "[sub-note type 2]"
    - name: "[bucket 2 name]"
      type: "[bucket 2 type]"
      sub_notes:
        - "[sub-note type 1]"
        - "[sub-note type 2]"
  project_term: "[project_term — what they call individual work items]"
  tag_taxonomy:
    domain: ["[derived from industry and role — e.g., shopify, wordpress, marketing]"]
    source: ["[derived from connected tools — e.g., meeting, email, monday, figma]"]
    status: ["active", "archived"]
    type: ["project-context", "moc", "meeting-notes", "reference", "knowledge", "changelog"]

tools:
  connected:
    - name: "[tool name]"
      connector: "[MCP connector identifier]"
      data_feeds: ["[what type of data flows — e.g., emails, board updates, calendar events]"]
  manual:
    - name: "[tool name]"
      input_method: "[how data gets in — e.g., inbox drop, conversation, copy-paste]"
  available_not_connected: []

rhythms:
  meetings: ["[recurring meetings extracted from Q3 — e.g., weekly client call, design review]"]
  work_patterns: "[weekly rhythm summary from Q3]"
  review_cadence: ""

pain_points:
  primary: "[pain_point from Q5]"
  secondary: []

progressive_features:
  active:
    - feature: "memory_management"
      activated: "[today's date]"
      reason: "Core feature — always active"
    - feature: "inbox_processing"
      activated: "[today's date]"
      reason: "Core feature — always active"
    - feature: "changelog_logging"
      activated: "[today's date]"
      reason: "Core feature — always active"
    - feature: "wikilink_discovery"
      activated: "[today's date]"
      reason: "Core feature — always active"
    - feature: "moc_maintenance"
      activated: "[today's date]"
      reason: "Core feature — always active"
    - feature: "frontmatter_conventions"
      activated: "[today's date]"
      reason: "Core feature — always active"
  dormant:
    - "meeting_processing"
    - "daily_briefing"
    - "project_health"
    - "knowledge_extraction"
    - "weekly_review"
    - "content_drafting"
    - "goal_tracking"
    - "email_triage"
    - "task_sync"
  suggested: []
  next_suggestion: "[mapped from pain_point — see Q5 mapping table]"
---

# Cortex Personality

This file tells Cortex who you are and how your vault is organized. It was generated during setup and evolves as you use Cortex. You shouldn't need to edit it manually — Cortex updates it as your work changes.
```

All fields must be populated from the captured values. If a value wasn't captured (user skipped a question or gave a vague answer), use a reasonable default and note it for refinement later.

---

## Step 6: Developer Setup

**Only run this step if `is_developer` is `true`.**

> "Since you're a developer, I can also set up Cortex for your coding sessions. When you open a project in Claude Code, Cortex will already know the project context, blockers, and recent decisions."

**6.1: Install Cortex skill for Claude Code**

Copy the entire `cortex-skill/` folder to `~/.claude/skills/cortex/` so the skill is available in Claude Code sessions.

**6.2: Offer repo pointers**

For any repos or codebases the user mentioned during discovery:

> "Want me to add a project pointer to any of your repos? That way Claude will automatically load the project context when you open them."

If they say yes, register each repo using `workflows/register-repo.md`. For each repo, ask for the absolute path and the matching project, then call register-repo. That workflow handles writing the stub `CLAUDE.md` and updating the registry — do not write a hand-crafted `CLAUDE.md` here.

If they have several repos at once and want a faster path, offer the backfill workflow:

> "If you have a folder full of project repos, I can scan it and register them all in one pass. Want me to do that instead? (yes / no)"

On `yes`, run `workflows/backfill-repos.md`.

If they're not sure, skip it:

> "No problem — you can register repos later anytime by saying 'register this repo' inside one, or 'scan my repos' to bulk-register."

---

## Step 7: Demo & Close

After the build completes, demonstrate that context awareness is working:

> "Your vault is built. Try me — ask me anything about your work."

Wait for them to ask a question. Answer using context from the vault — reference their buckets by name, pull from any data that was imported, cite their tools and rhythms. This proves persistent memory works.

Then close:

> "Cortex is set up. Your vault will grow as you use it — drop meeting notes, ask me questions, tell me about your day. The more you share, the more I can help. Imagine the things you could do now."

</flow>

<error_handling>

- **Obsidian install fails** — Provide the direct download link (https://obsidian.md/download) and manual instructions. Walk them through it step by step. Do not abandon the flow.
- **Connector auth fails** — Skip the tool. Note it in the personality file under `available_not_connected`. Offer to retry later: "No worries — we can set that up later."
- **Vague discovery answers** — Work with what you have. Use reasonable defaults. The personality file can be refined in future sessions.
- **User wants to stop mid-flow** — Save all captured values to a partial `personality.md` with a `setup_status: incomplete` field. Next time the skill detects this partial file, offer to resume where they left off.
- **No tools to connect** — Skip Step 4 entirely. Build the vault without pulled data. The user will feed it manually through inbox drops and conversations.
- **Vault creation fails** (permissions, disk space) — Suggest an alternative path. Try `~/Documents/` first, then `~/Desktop/` as a fallback.
- **Never block the entire flow on one failed step.** Log the failure, skip forward, and note what needs to be revisited.

</error_handling>

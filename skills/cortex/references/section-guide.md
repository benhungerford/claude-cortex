<overview>
Detailed guidance on filling out each section of the project context markdown. Use when you need help deciding what belongs where, or when prompting the user for the right information.

Read personality.md in the vault root to get the user's name, role, and vault path before using this guide.
</overview>

<section name="project-overview-and-goals">

**What goes here:** The elevator pitch for the project. Should answer: What are we building, for whom, and why?

**Key things to extract from raw input:**

- The client's stated goal (not just "build a website" — what outcome do they want?)
- Any hard deadlines or phased delivery expectations
- Success criteria — how will the client know this project was successful?

**Clarifying questions to ask if missing:**

- "What does success look like for the client at the end of this project?"
- "Are there specific phases or a hard launch deadline?"

</section>

<section name="client-info-and-contacts">

**What goes here:** Everyone involved on the client side, their role, and how decisions get made.

**Key things to track:**

- Who has final say on design and scope decisions?
- Who handles day-to-day communication vs. who signs off?
- What's the preferred communication channel?

**Flags to watch for:**

- If the decision maker isn't the day-to-day contact, scope creep risk is higher — flag this.
- If approval status is vague, prompt the user to clarify what has actually been signed off.

</section>

<section name="tech-stack-and-architecture">

**What goes here:** The full technical picture — platform, hosting, theme, plugins, environments.

**Key things to extract:**

- CMS or platform (WordPress, Shopify, Webflow, custom, etc.)
- Hosting provider and plan
- Theme or starter framework
- Must-have plugins or packages (especially ones the client is already using or paying for)
- Dev, staging, and production environment URLs

**Adaptive guidance:**

- For WordPress: note PHP version, whether multisite is involved, page builder (Elementor, Divi, Gutenberg, ACF, etc.)
- For Shopify: note theme name/version, whether custom liquid is needed
- For custom builds: note framework, Node version, deployment method

</section>

<section name="integrations-and-apis">

**What goes here:** Every external system that needs to connect to this project.

**Status values:** Not Started, In Progress, Done, Blocked

**Key things to track per integration:**

- What it does (why it's needed)
- Whether credentials / API keys are available
- Whether a sandbox/test environment exists
- Known limitations or compatibility issues

**Dependency clarifying questions:**

- "Do you have API credentials for [X] yet?"
- "Is there a sandbox environment available for testing [X]?"
- "Has [integration] been confirmed as in-scope by the client?"

</section>

<section name="design-decisions-and-figma">

**What goes here:** All design-related context — what's been approved, what's still in flux, where the files live.

**Key things to track:**

- Figma file URL and current approval status
- Any brand guidelines or asset packs
- Specific decisions that have been locked in (typography, color palette, layout patterns)
- Anything the client has explicitly rejected or flagged

**Flags to watch for:**

- If design is still in review, flag before the user starts building against it
- If no Figma file exists, ask what the design reference is

</section>

<section name="file-paths-and-repo">

**What goes here:** Where stuff lives — locally, in the cloud, and in any project management tools.

**Key things to log:**

- GitHub / GitLab repo URL
- Local dev path
- Key subdirectories worth calling out
- Project management tool links (Monday.com, Notion, Jira, etc.)
- Any shared drives or client asset folders

</section>

<section name="pages-and-templates-tracker">

**What goes here:** Every page or template the project requires, with its current build status.

**How to populate on first pass:**

- Extract all pages mentioned in the brief or sitemap
- Default all to Not Started
- Add a Notes column for anything worth flagging (e.g., "needs client content", "Figma not finalized")

**Status values:** Not Started, In Progress, In Client Review, Done / Live

**Update this section proactively** when the user mentions completing a page or starting work on something new.

</section>

<section name="project-stage-tracker">

**What goes here:** High-level project phases and their status.

**Standard stages (adapt as needed):**

1. Discovery & Brief
2. Design / Wireframes
3. Dev Environment Setup
4. Content Migration
5. Core Build
6. Integrations
7. Client Review
8. QA & Testing
9. Launch
10. Post-Launch

**Update proactively** when the conversation signals a stage has progressed. Don't wait to be asked.

</section>

<section name="open-questions-and-blockers">

**What goes here:** Anything unresolved that could affect the build, scope, or timeline.

**Types:**

- **Scope** — Is X in or out? Has the client confirmed Y?
- **Dependency** — Is [asset / access / API] available yet?
- **Decision** — A technical or design choice that hasn't been made yet

**Prioritization rule:** Surface blockers that are on the critical path first. If something is blocking the current task, flag it immediately.

**Update this section** every time a question gets resolved (move to Changelog) or a new one emerges.

</section>

<section name="project-specific-fields">

**What goes here:** Fields that only apply to certain project types. The base template includes three presets — remove what doesn't apply, and add custom fields freely.

**WordPress Migration extras to consider:**

- Current host + plan type (shared, managed WP, VPS)
- New host + plan type
- Domain registrar and whether the user has access
- Migration method (Duplicator, All-in-One WP Migration, Migrate Guru, manual)
- DNS cutover plan (who controls DNS, any downtime window needed)
- Redirect strategy (especially if URL structure is changing)
- SSL certificate situation on new host

**E-commerce extras to consider:**

- Payment gateway and whether it's already configured
- Inventory or ERP system integration
- Shipping zones and tax settings
- Affiliate/influencer platform (Impact.com, ShareASale, etc.)

**API / Integration extras to consider:**

- Auth method (API key, OAuth, webhook)
- Rate limits
- Webhook endpoints needed
- Whether a staging/sandbox API key exists

</section>

<section name="changelog-and-decision-log">

**What goes here:** A running log of every meaningful change to scope, design, or technical direction.

**Log an entry when:**

- A requirement changes
- A design decision gets locked in
- An open question gets resolved
- A scope item is added or removed
- A technical approach is chosen over an alternative

**Format:** Date · What changed · Who decided it · Any relevant notes

**This log is how you track project evolution over time** — it's the answer to "wait, why did we decide to do it this way?"

</section>

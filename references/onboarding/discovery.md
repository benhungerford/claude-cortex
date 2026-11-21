# Onboarding: discovery reference

Lookup tables for the five discovery questions in `workflows/onboarding.md`. They are starting points. The user's own words always win, and a rename needs no apology.

## Q2 vocabulary menu

Offer 5-7 terms that fit the user, not the whole list.

| User type | Terms |
|---|---|
| Agency, freelance | clients, projects, briefs, retainers, accounts, campaigns |
| Legal | matters, cases, files, dossiers, mandates |
| Healthcare | areas, programs, supervisions, CE, referrals (not "patients" when patient data stays out of the vault) |
| Real estate | properties, listings, buyers, sellers, closings |
| Trades, field service, dispatch | jobs, tickets, loads, runs, sites, customers |
| Hospitality | locations, properties, services |
| Academic | manuscripts, advisees, courses, grants, conferences |
| Engineering | services, repos, components, systems |
| Product | initiatives, squads, products, workstreams |
| Creator | channels, pillars, shows, content streams |
| Nonprofit, HR | programs, campaigns, workstreams, areas |
| Clergy | ministries, sacraments, pastoral areas (Bereiche) |
| Writer, translator | manuscripts, books, commissions |
| Cybersecurity, consulting | engagements, missions |
| Casework | cases, families |
| Events, photography | weddings, shoots, sessions, events |
| Music teaching | students, lessons, performances |
| Funeral home | services, families |
| Bookkeeping | clients, accounts, books |
| Student, hobbyist | projects, repos, schoolwork |

## Q2 shape: archetypes

| Signal | Archetype | Folder shape |
|---|---|---|
| 3-15 named, discrete buckets | `portfolio` | One folder per bucket, nested if the user has children |
| 20+ active items in a recurring stream | `queue` | One folder with `Active.md`, `Archive/`, and a template; no folder per item |
| One main thing with sub-streams | `single_product` | `<product>/` with a folder per workstream |
| Several independent axes | `hybrid` | One top-level folder per axis |

Archetype can differ per bucket (a job hunter: Projects is a portfolio, Applications a queue, Learning a single product). Some users need a third level (agency → clients → projects; chambers → pupils → matters); capture `grandchild_term`.

## Q3 sub-notes by industry

Suggest the type, then use the user's label. When nothing fits, build the list from what they described in Q3.

| Industry | Sub-notes |
|---|---|
| Agency, freelance brand | Design, Deliverables, Content, Business |
| Web developer (client builds) | Tech Stack & Architecture, Design System |
| Senior engineer, SRE | Tech Stack & Architecture, Decisions Log, Postmortems, Runbooks |
| Junior engineer, student | Tech Stack, Notes |
| Product manager | Strategy (senior only), Decisions Log, Deliverables, Stakeholders |
| Designer | Design Specs, Decisions Log, Stakeholders, Deliverables |
| UX writer | Copy Decks, Voice & Tone, Client Comms |
| Game dev | Game Design Doc, Playtests, Tech Stack, Art/Audio |
| Filmmaker | Script, Production, Post, Festivals & Grants, Budget |
| Event photographer | Timeline, Shot List, Client Communication, Vendors, Delivery |
| Musician | Setlist, Charts, Personnel, Venue Notes |
| Podcaster | Show Brief, Episodes, Stakeholders |
| Creator | Content Calendar, Sponsors, Analytics, Revenue, Community |
| Illustrator | Brief & References, Roughs, Finals, Contract & Rights |
| Writer, memoirist | Manuscript, Chapters, Sources & Interviews, Themes |
| Literary translator | Manuscript, Sources, Correspondence, Contract |
| Academic | Manuscript, Citations, Advisee Notes, Submissions |
| Field researcher | Field Journal, Finds Register, Permits & Compliance |
| Teacher (institution side) | Lesson Plans, Curriculum, Assessment, Parent Comms, CPD (no pupil notes) |
| Tutor | Lesson Plans, Homework, Progress Notes, Parent Communication |
| Solicitor, barrister | Pleadings, Discovery, Correspondence, Time & Billing, Authorities |
| Civil-law notary | Acte, Documents, Correspondance, Signature, Minutier |
| Healthcare or mental health (non-patient ops) | Admin, Supervision, CE, Referral Partners, Credentials |
| Funeral home | Arrangement Notes, Paperwork, Vendors, Timeline, Family Follow-Up |
| Analyst | Query Library, Methodology, Stakeholders, Deliverables |
| Trades, construction | Punch List, Draws & Payments, Site Photos, Budget |
| Real estate | Listings, Buyers, Sellers, Closings (flipping: Property Status, Contractors, Budget, Inspections) |
| Restaurant, hotel, small business | Operations, Vendors, Inventory or Bookings, Marketing, Compliance |
| Management consultant | Engagement Plan, Decisions, Deliverables, Stakeholders |
| Security consultant | Recon, Evidence, Report Draft, Scope & NDA |
| E-commerce | Catalog, Marketing, Operations, Customer Service |
| HR | Per workstream, plus Compliance and Vendors |
| Bookkeeper | Filings, Reconciliation, Correspondence, Time & Billing |
| Financial planner | Financial Plan, Portfolio, Insurance & Estate, Tax, Compliance |
| Nonprofit | Funder Reports, Budget, Safeguarding Log (flags only), Compliance |
| Caseworker | Status, Housing, Documents, Contacts (coded, never full names) |
| Logistics | Rate Con, BOL, Claims, Pay Status |
| Inspector, factory supervisor | Inspection Reports, Incident Log, Maintenance, Audit Trail |
| Architect, engineer | Design Packages, Drawings & Submissions, RFIs, Code Review |
| Pharma research | SAP, TLFs, Methodology, Regulatory Correspondence |
| Investigative journalist | Documents, Source Log (initials only), FOIA Requests, Timeline, Risk Assessment |
| Clergy | Administration, Appointments, Correspondence, Pastoral (codename only) |
| Hobby projects | Ideas, To Build, What I Learned, Bugs |

## Q4 tools

Check each tool against the live connector registry. This table is a fallback when the registry can't be reached; note that it may be stale.

| Tools | Status |
|---|---|
| Gmail, Google Calendar, Google Drive, Slack, Figma, Monday.com | Native connector |
| Notion, Linear, Granola, GitHub, Jira, Stripe, Asana, HubSpot | Native or community; verify |
| Outlook, Teams, SharePoint, Apple Mail, Apple Notes, iCloud Calendar | No connector; manual is normal |
| Industry SaaS (Clio, DocuSign, QuickBooks, Xero, Workday, Toast, Jobber, ServiceTitan, etc.) | Usually no connector; manual |
| Local apps (Photoshop, Logic, AutoCAD, Zotero, R, Tableau, etc.) | No connector |
| Patient, student, or safeguarding systems; telehealth | Don't connect (`references/onboarding/compliance.md`) |

## Q5 pain points to features

| Pain | Feature |
|---|---|
| Meeting decisions, action items | `meeting_processing` |
| Overwhelmed starting the day | `daily_briefing` |
| Stale projects, missed deadlines, renewals | `project_health` |
| Solving the same problem twice | `knowledge_extraction` |
| Forgetting what happened last week | `weekly_review` |
| Email follow-ups | `email_triage` |
| Tasks scattered across tools | `task_sync` |
| Conversations and contacts losing their thread | `conversation_threading` |
| Who was billed | `transaction_log` |
| Audit gaps | `audit_log` (on automatically in audit mode) |

## Idioms to avoid

For users writing in a second language, and for low-tech users, use the literal phrase:

| Avoid | Say |
|---|---|
| falling through the cracks | what you keep losing track of |
| second brain (after Step 1) | memory layer |
| wire up | connect |
| under the hood | inside |
| down the road | later |
| heads up | one quick thing |
| sound good? | OK? |
| keep an eye on | track |
| grab (a download) | download |
| iron out | fix |
| hit the ground running | start right away |
| ballpark | rough estimate |
| circle back | come back to |

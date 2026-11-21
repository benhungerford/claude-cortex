# Onboarding: personality.md schema

The values onboarding captures, written to `<vault>/personality.md` as YAML frontmatter at Step 5. Every other Cortex skill reads this file, so keep field names exact. Leave a field out rather than inventing a value; if something needed is missing at Step 5, ask.

```yaml
identity:
  name: ""
  role: ""                  # verbatim
  company: ""               # verbatim; may be "freelance" or empty
  industry: ""
  self_description: ""      # verbatim, never cleaned up
  is_developer: false       # true only when the user says they code
  is_minor: false           # only if they said so; also under_13 when it applies
  works_with_minors: false
  pronouns: ""              # only if volunteered; never ask
  accessibility:
    screen_reader: false
    low_vision: false
    no_audio: false
    sensory_predictability: false
    locale_hint: ""         # BCP-47, e.g. "de-DE"
    neurodivergence_signals: []
  compliance_constraints: []
  soft_constraints: []
  exclude_on_ingest: []
  audit_mode: false

mental_model:
  bucket_term: ""           # the user's top-level word: Clients, Matters, Bereiche
  buckets:
    - name: ""
      type: ""
      archetype: ""         # portfolio | queue | single_product | hybrid
      child_term: ""
      grandchild_term: ""   # only for three-level work
      nested: false
      sub_notes: []         # user's labels
      compliance_override: ""
  secondary_axes: []        # list of {name, type, archetype}: vendors, sources, funders...
  parallel_threads: []      # list of {name}: a dissertation, a book
  restricted_subnotes: []
  vault_archetype: ""       # or "mixed"
  project_term: ""

tone_register: warm         # warm | casual | terse | formal
trust_register: default     # default | high_disclosure
build_mode: fresh           # fresh | sandbox | metadata_only
surface_at_setup: ""        # claude_code | claude_desktop
secondary_surface: {}       # {type: ipad|phone|second_computer, sync_strategy: icloud|obsidian_sync|syncthing|none}
co_installer: ""            # e.g. "son Marcus"
setup_status: complete      # incomplete while partway, so the next session resumes

tools:
  connected: []             # {name, connector, pull_mode: full|metadata_only, data_feeds}
  manual: []                # {name, input_method}
  available_not_connected: [] # {name, reason}
  never_connect: []

rhythms:
  meetings: []
  work_patterns: ""
  review_cadence: ""

pain_points:
  primary: ""
  secondary: []

progressive_features:
  active: [memory_management, inbox_processing, changelog_logging, wikilink_discovery, moc_maintenance, frontmatter_conventions]
  dormant: [meeting_processing, daily_briefing, project_health, knowledge_extraction, weekly_review, content_drafting, goal_tracking, email_triage, task_sync, conversation_threading, transaction_log, audit_log]
  next_suggestion: ""       # from the Q5 pain point
```

Notes on capture:

- `is_developer` turns on only for self-reference ("I code", "my repos", "I write Swift"). Having developers on the team, Excel macros, or managing engineers doesn't count. If it was set wrongly, correct it quietly and skip Step 6.
- `self_description` is the user's sentence as they wrote it.
- `secondary_axes` is a list. A funeral home (services, families, vendors, clergy) or a journalist (investigations, sources, corpus) needs several.
- The dormant feature format and activation signals are in `references/progressive-features.md`.
- Session-only values (platform, CPU architecture, bandwidth, cloud-sync collision, IT-managed) guide setup and don't need to be stored.

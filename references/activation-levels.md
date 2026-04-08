# Activation Levels (L1 / L2 / L3)

**STATUS: Stub.** Content being migrated from `skills/cortex/SKILL.md` `<activation_levels>` section in Stage 2 step 2.

## Purpose

How Cortex modulates behavior based on session context. Loaded by `cortex-boot` to determine how aggressively to read/write the vault in a given session.

## Contents (to migrate)

- **Level 1 — Passive:** default outside vault and registered repos. Memory loaded silently. Watches for Tier 1/2 captures.
- **Level 2 — Vault-Aware:** cwd is in vault, or user mentions a project by name. Reads relevant context files. Actively watches for capture.
- **Level 3 — Full Project:** cwd resolves to a registered repo, or user focuses on a specific project. Surfaces blockers proactively, flags scope creep, reads project hub on every turn. Read-only against the vault by default — explicit confirmation required before writing vault changes from a repo session.
- Escalation rules (how to move up/down the levels mid-session)

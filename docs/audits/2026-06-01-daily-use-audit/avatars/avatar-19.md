---
avatar_id: "19"
persona: "iPad-primary user, no terminal access ever, Desktop-only daily workflow"
surface: "Claude Desktop (iPad)"
audit_date: "2026-06-01"
auditor: "stress-test subagent"
---

# Avatar 19 — Audit Report

## Persona

**Label:** iPad Power User, Terminal-Free  
**Surface:** Claude Desktop app on iPad (no keyboard, no shell, no Finder, no terminal ever)  
**Daily pattern:** Opens Claude Desktop every morning, works across 3-4 active projects, pastes meeting notes from Granola/Fathom shared links, asks status questions between client calls, occasionally surfaces a reusable pattern worth filing. Never touches a terminal. Cannot run `install-desktop.sh`, `cortex-index`, or any CLI commands. Cannot inspect files in Finder, can't check if a node process is running.

---

## Simulated Day-in-the-Life

**7:55 AM — Session opens in Claude Desktop on iPad.**  
The `session-start` hook fires. Under the hood it calls `boot-context.py`, which reads `~/.claude/cortex/config.json` for the vault path, loads `personality.md`, `memory.md`, and the last 15 lines of `_changelog.txt`. Since the user's iPad cwd is almost certainly not inside any registered repo (`PWD` on Claude Desktop iPad is likely something like `/`, the app sandbox directory, or at best the user's home directory), `resolve_cwd` returns L1 (Passive). The user gets no boot-time summary — just a blank session.

If Cortex is even running at all. This is the first major question for this persona.

**8:00 AM — "What's the status of FKT?"**  
The `user-prompt-submit` hook fires, pattern-matches on `*"what's the status"*`, injects `<cortex-hint>likely-skill: cortex-check-status</cortex-hint>`. Cortex reads the FKT hub via `read_hub` MCP tool and delivers a 4-sentence status summary. This works fine — IF the MCP server is connected.

**9:15 AM — Pastes a 60-line Granola transcript from a client call.**  
`user-prompt-submit` hook fires: `LINE_COUNT >= 20` + `SPEAKER_COUNT >= 3` → routes to `cortex-process-meeting`. Cortex creates the meeting note, threads it to the previous FKT standup, extracts 2 decisions, hands off to `cortex-update-context`. The post-tool-use hook fires for each `mcp__obsidian__write_note` call and logs to `_changelog.txt`. Looks clean — but the re-indexing step (`reindex-one.js`) runs silently in the background via `node` subprocess. If `node` is not on PATH in the Claude Desktop launch environment on iPad (it never is), the file is written but never indexed. Future `recall_related` calls will miss this note.

**11:30 AM — Mid-project conversation. User says "going with Shopify Payments instead of Stripe".**  
This is a Tier 1 capture (decision). `user-prompt-submit` matches `*"going to go with"*` (close but actually the trigger is `*"going with"*` — not in the pattern list). The exact phrase "going with" is NOT in the `user-prompt-submit` triggers (only `*"going to go with"*` and `*"i'm going with"*` are listed). The hook fires empty (`{}`). No `<cortex-hint>` is injected. Cortex would have to rely entirely on ambient Tier 1 detection from `cortex-boot`'s capture watch — which is good, but the hook's job was to pre-route it and it missed.

**1:00 PM — "What's left on Bubl Shots?"**  
Works via `cortex-check-status`. `read_hub` reads the Bubl context hub. One-line status delivered.

**3:45 PM — User closes Claude Desktop.**  
The `stop` hook fires. It checks for `pending-memory.json` in `$PLUGIN_DATA/session-cache/` and flushes any queued memory updates to `memory.md`. This relies on `python3` being available and the session-cache directory being writable. On iPad, the session-cache directory path (`$HOME/.claude/cortex/plugin-data/session-cache/`) may not exist if the user never ran the install script (they can't — no terminal). Any memory queued during the session is silently dropped.

**All day — Recall never fires above threshold.**  
Semantic recall (`recall_related`) requires `search.db` to exist and be populated. The vault is indexed by running `/cortex-index` (which calls `reindex_vault` MCP tool) or by the `reindex-one.js` post-tool-use background subprocess. If the user has never run an explicit index (they haven't — no terminal), `search.db` does not exist. `openDb()` in `search-db.js` will create the `.cortex/` dir and an empty DB, but the DB has zero rows. Every `recall_related` call returns `count: 0`. The ambient recall step in `cortex-boot` Step 6 silently produces no results for the entire user lifetime. The user never knows the feature exists or is broken.

---

## Findings

### Finding 1 — P0: Hooks almost certainly never fire on Claude Desktop iPad

**Title:** Session-start hook cannot run on Claude Desktop iPad (shell dependency on an inaccessible runtime)

**Area:** boot

**Evidence:** `hooks/session-start` line 22-24:
```bash
if ! command -v python3 &>/dev/null; then
    exit 0
fi
```
And `hooks/post-tool-use` line 17-20, `hooks/stop` line 13-18 — same pattern.

The hooks are POSIX bash scripts that require `python3` on PATH. Claude Desktop on iPad runs in a sandboxed app container. The iPad has no user-accessible shell. Even on macOS Claude Desktop, the app's process environment typically does not inherit a user's `$PATH` (no `.zshrc` is sourced), so `python3` is often not found unless the user has added it to `$PATH` globally via `/etc/paths.d/` or similar. On iPad specifically, there is no such mechanism at all — bash and python3 are not available.

The hooks silently `exit 0` when `python3` is missing, which means:
- No `<cortex-session>` block is ever injected
- `cortex-boot` sees no block → routes to `cortex-onboarding` every single session
- The user is permanently stuck in onboarding loop or in a state where `cortex-boot`'s Step 1 fires `cortex-onboarding` and the user has no way to complete onboarding without a terminal

The hooks.json `SessionStart` matcher `"startup|clear|compact"` is also an issue: on iPad, session starts may not match these terms at all.

**Impact:** The entire boot pipeline, activation levels, vault context injection, and memory flush are dead for this persona. Cortex is effectively a generic LLM with no vault awareness every single session.

**Suggested fix:** Add a fallback boot path that reads config directly via the MCP server when the hook cannot inject a session block. The `cortex-boot` skill's Step 1 ("if absent → hand off to cortex-onboarding") should be changed to also check whether MCP tools are available and, if so, attempt to read the vault config via `read_hub` or a new `get_boot_context` MCP tool that the skill calls directly — bypassing the hook entirely. This makes boot MCP-first and hook-second, which works on all platforms including iPad.

---

### Finding 2 — P0: Semantic index (search.db) is never populated for a terminal-free user — recall and search are permanently broken

**Title:** search.db is never built without terminal access; recall_related silently returns zero results forever

**Area:** recall

**Evidence:** `mcp-servers/cortex-vault/lib/indexer.js` — `indexVault` and `indexOne` are the only indexing paths. `indexVault` is called by the `reindex_vault` MCP tool (via `/cortex-index` command). `indexOne` is called by `hooks/post-tool-use` line 207:
```bash
(node "$REINDEX_BIN" "$VAULT_PATH" "$REL_PATH" >/dev/null 2>&1 &) || true
```
This requires `node` on PATH in the hook environment — also unavailable on iPad.

The MCP `reindex_vault` tool does exist and could be called directly from within a Claude session. The `/cortex-index` command file exists at `commands/cortex-index.md`. But there is no automatic trigger that tells the user "your vault needs indexing." On a first install with no terminal, the user never gets prompted to run the index, the DB stays empty, and `recall_related` returns `{ count: 0, results: [] }` on every call.

`embeddings.js` uses `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2` — this model must be downloaded on first use. On iPad where Claude Desktop's node environment may have network restrictions or the model cache may not persist between app launches, the first embed call could silently fail, leaving `indexOne` broken even when node is present.

**Impact:** Ambient recall never surfaces related notes. Status checks miss context. Knowledge Base search produces no results. This is the most-used daily feature for a knowledge-worker persona and it silently does not work.

**Suggested fix:** Add a "vault health check" MCP tool that cortex-boot can call when the session block is present but the DB is empty or stale (last indexed > 7 days). Surface a one-line prompt: "Your vault search index is empty — say '/cortex-index' to build it." Make `reindex_vault` the primary path and make it callable without a terminal. Document the iPad install path explicitly.

---

### Finding 3 — P1: cwd on Claude Desktop iPad is always outside the vault, so users are permanently L1 with no project context at boot

**Title:** iPad cwd is always outside vault — activation never reaches L2/L3 automatically

**Area:** activation

**Evidence:** `hooks/lib/boot-context.py` lines 121-154, `resolve_cwd` function. The L2/L3 decision depends on `os.getcwd()` (passed via `--cwd "${PWD:-/}"` in `session-start` line 30). On iPad, `PWD` in a sandboxed process is likely `/` or the app container directory — never the user's Obsidian vault or a registered repo path.

The L2 escalation check `is_inside_vault = cwd_real.startswith(vault_real + os.sep)` will always be False on iPad because vault is at e.g. `/Users/…/Documents/The Vault` and cwd is at `/` or `/private/var/…`.

The L3 registry walk also fails: `candidate = cwd_real` starts at `/` and the while loop `while candidate != os.path.dirname(candidate)` terminates at root immediately without matching any registered repo.

**Impact:** Every iPad session starts at L1. The L3 boot line ("FKT — Integrations. 2 open blockers. Ready.") that is the primary value proposition of Cortex for a focused project worker never appears. The user must manually mention a project name every session to get L2 behavior, and cannot get L3 without saying "let's work on FKT" explicitly every morning. This is friction on every single daily session.

**Suggested fix:** Add a `default_project` field to `config.json` that the user can set during onboarding. When `resolve_cwd` returns L1 on a surface where cwd is meaningless (detectable by checking if cwd is `/` or a known app-container path), fall back to the default project and open at L2 or L3 automatically. Alternatively, expose a "set default session project" command that writes to config.

---

### Finding 4 — P1: "going with X" decision phrase misses the user-prompt-submit hook — silent non-capture on the most common natural decision phrasing

**Title:** Natural phrase "going with X" not in trigger list; ambient capture depends entirely on model judgment

**Area:** capture

**Evidence:** `hooks/user-prompt-submit` lines 93-97:
```bash
*"we decided"*|*"decision:"*|*"i'm going with"*|*"going to go with"*|*"final answer is"*|*"we're using "*)
```
The phrase `"going with"` alone (without "I'm" or "going to go") is not matched. A user saying "going with Shopify Payments" or "we're going with Rebuy" (note: "we're using" is matched, but "we're going with" is not) would produce no `<cortex-hint>`. 

Similarly missing: "decided on", "picked X", "chose X", "confirmed X", "settled on X", "locked in X", "approved X" — all natural English decision phrasings.

The `references/trigger-phrases.md` row 7 lists `"I'm going with"` and `"going to go with"` as the canonical forms, but real conversational usage varies widely. The hook's hardcoded patterns are too narrow.

**Impact:** Real-world decision capture misses on natural phrasing variants. The user says "going with Stripe" after a 30-minute conversation, nothing gets flagged for capture, and the decision is lost. The ambient `cortex-boot` capture watch is a fallback, but it has no hook pre-signal to lean on.

**Suggested fix:** Expand the trigger set to include: `"going with"`, `"decided on"`, `"locked in"`, `"chose "`, `"picked "`, `"confirmed "`, `"settled on"`, `"approved "`. These are all high-precision decision signals. Also consider a single broader regex: anything that combines a first-person or "we" subject with a past-tense selection verb + a project-related noun.

---

### Finding 5 — P1: read_hub extracts open_questions and blockers from `- [ ]` checkbox format, but boot-context.py expects a Markdown table format — schema mismatch between the two parsers

**Title:** read_hub (MCP) and boot-context.py parse the project hub's Open Questions section with incompatible formats

**Area:** status

**Evidence:** `mcp-servers/cortex-vault/tools/read-hub.js` lines 44-61:
```js
function extractOpenQuestions(body) {
  return sectionContent.split('\n')
    .filter((line) => line.match(/^- \[ \]/))
    ...
}
function extractBlockers(body) {
  return sectionContent.split('\n')
    .filter((line) => line.match(/^- \[ \]/))
    ...
}
```
These functions look for `## Open Questions` and `## Blockers` sections with `- [ ]` checkbox list format.

`hooks/lib/boot-context.py` lines 205-224 (`parse_hub`):
```python
oq_section = re.search(
    r'## Open Questions & Blockers\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)',
    content,
)
```
This parser looks for `## Open Questions & Blockers` (one combined section) in **Markdown table format** (`| col | col |`).

The two parsers expect different section names (`## Open Questions` + `## Blockers` vs `## Open Questions & Blockers`) AND different formats (checkbox list vs Markdown table). If the hub was scaffolded in table format (which `cortex-ingest-project` produces per the boot-context.py expectations), `read_hub` returns empty `open_questions: []` and `blockers: []` every time. If the user's vault uses checkbox format, boot-context.py misses everything.

**Impact:** `cortex-check-status` reads the hub via `read_hub` and will report "no open blockers" even when blockers exist (if the hub uses table format). The boot-context.py parser will also miss blockers on hubs using checkbox format. Status checks — a core daily-use feature — silently return wrong data.

**Suggested fix:** Unify the parsing logic. Either (a) have `read_hub.js` support both formats with the table format as primary, or (b) have `scaffold-project.js` generate hubs using the `- [ ]` checkbox format that `read_hub.js` expects. The canonical format should be defined in one place and both parsers should derive from it. Add a test that creates a hub with the scaffold template and verifies both parsers extract the same blockers.

---

### Finding 6 — P2: stop hook memory flush relies on pending-memory.json written by session logic, but there is no clear path for the model to write that file on Claude Desktop (no Write tool targeting plugin-data)

**Title:** Memory persistence (stop hook) depends on a plugin-data file that the model cannot create via MCP or Write tool — memory updates are silently lost

**Area:** boot

**Evidence:** `hooks/stop` lines 100-106:
```bash
PENDING_FILE="$PLUGIN_DATA/session-cache/pending-memory.json"
if [[ ! -f "$PENDING_FILE" ]] || [[ ! -s "$PENDING_FILE" ]]; then
    printf '{}\n'
    exit 0
fi
```
The stop hook reads `pending-memory.json` from `$PLUGIN_DATA/session-cache/`. For this file to exist with content, the model (or some skill) must have written it during the session. The `cortex-boot` SKILL.md and `cortex-update-context` SKILL.md make no mention of writing to `pending-memory.json`. The capture rules say memory updates should be queued — but nowhere in the skill files is there an explicit instruction for the model to write to `$HOME/.claude/cortex/plugin-data/session-cache/pending-memory.json`.

On Claude Desktop, the model's Write tool writes to the file system, but writing to an arbitrary plugin-data path requires the user to have explicitly granted that path access. On iPad specifically, the user cannot configure path permissions (no settings.json editing without a terminal or a code editor). The path also changes depending on `CLAUDE_PLUGIN_DATA` env var, which is set by the plugin runtime — the model would need to know the resolved path.

**Impact:** Memory updates (things like "user prefers concise responses", "FKT deadline moved to Q3") are never persisted between sessions. The `<cortex-memory>` block loaded at boot always reflects only what was written before install — never what accumulated during daily use. For a long-term vault user, this is a significant knowledge degradation.

**Suggested fix:** Add an MCP tool `update_memory` to the `cortex-vault` server that the model can call explicitly to queue a memory update. The stop hook already has the flush logic; the missing piece is a model-accessible write path. The skill files (especially `cortex-update-context` and `cortex-boot`) should explicitly call this tool when a memory-worthy fact surfaces. This removes the dependency on the model knowing an opaque file path.

---

## Summary

For this iPad-primary, terminal-free, Desktop-only persona, Cortex's daily loop is almost entirely non-functional at the infrastructure layer. The hook-based boot pipeline requires python3 and bash in the process environment — both absent on iPad. The semantic index requires a terminal-initiated build or a post-tool-use node subprocess — both absent on iPad. The activation level mechanism depends on cwd — meaningless on iPad. The memory persistence path is opaque to the model.

The MCP server (`cortex-vault`) and its 14 tools are the only part of the architecture that is genuinely surface-agnostic and would work on iPad. But they are positioned as a "preference over manual file operations" rather than the primary execution path. For this persona, the MCP tools need to be the *only* path — all hook-dependent behavior needs an MCP fallback.

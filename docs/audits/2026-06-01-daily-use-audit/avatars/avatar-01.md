---
avatar: "01"
persona: "Solo Shopify/WordPress dev — 2–3 active clients, CLI-primary, L3 repo sessions, captures decisions mid-build"
date: "2026-06-01"
surface: "Claude Code CLI"
auditor: "Stress-test sub-agent"
---

# Avatar 01 — Daily-Use Audit

## Persona

Solo freelancer (Ben-archetype). Three active clients: an ongoing Shopify build (FKT / Frankl & Thomas), a WordPress site, and a smaller Shopify compliance project (Bubl Shots). Works exclusively from the Claude Code CLI. Typical day: opens a terminal in a project repo, fires Claude Code, and is immediately in an L3 session. Captures tech decisions mid-build ("we're going with Rebuy for the cart"), clears blockers as they land ("got the Stripe sandbox creds"), fires `from my call with Ashley` transcripts mid-afternoon, occasionally checks "what's blocking FKT?" between tasks.

---

## Simulated Day-in-the-Life

**08:45 — Opens Claude Code from `/Documents/Freelance Projects/fkt-checkout/`**

`session-start` fires, Python boots, walks up from cwd, matches the FKT registry entry, reads the hub, builds the `<cortex-session>` block. Everything here works correctly and silently. First message from the user: "morning, let's keep building the Rebuy cart integration." `cortex-boot` opens with one line: project name, stage, blocker count. Clean.

**09:10 — Mid-build decision: "we're going with Rebuy for the cart instead of ReCharge"**

The `user-prompt-submit` hook fires. LOWER contains `we're using rebuy for the cart` — wait, actually the literal is `"we're going with rebuy"`, which matches `*"going to go with"*` in the hook's case statement. But "we're going with" (contraction of "we are going with") does NOT match `*"going to go with"*`. The hook misses it. The model itself has to catch this via the ambient L3 capture watch. This is a real miss: the hook fires a 0-output `{}` for a phrase the user is likely to type verbatim, leaving capture entirely to model-side ambient watch. No `<cortex-hint>` is injected. The model picks it up because it's L3, but only because of activation-level-3 ambient watch — there is no hook reinforcement for "we're going with X."

**09:40 — Writes new component file inside the repo**

`post-tool-use` fires for `Write`. The file path is inside the repo (`/Documents/Freelance Projects/fkt-checkout/src/...`), NOT inside the vault. The hook resolves vault path from `vault-path.txt`, compares. The repo path doesn't start with `VAULT_PATH/`, so it exits silently. Correct behavior. But the hook also fires a background `reindex-one.js` only for files inside the vault. A newly-created note in the vault would be indexed on write. The developer won't see any hint that the embedded index is stale.

**10:15 — Types: "what's blocking FKT?"**

`user-prompt-submit` hook fires. `*"what's blocking"*` matches the status-query pattern at 3f. A `<cortex-hint>` for `cortex-check-status` is injected. Model reads hub via `read_hub` MCP tool. Clean.

**10:20 — "got the Stripe creds — clearing that blocker"**

Hook: `LOWER` contains `got the stripe creds`. The trigger at 3c is `*"we got "*(where X is a previously-logged blocker)` — but that comment lives only in the routing table doc; in the actual hook bash code (line 105), the pattern is only `*"that's resolved"*|*"blocker resolved"*|*"unblocked"*`. "got the Stripe creds" does NOT match any of those. The hook fires `{}`. Model catches it via ambient L3 because "clearing that blocker" appears in the message, but the hint that could have re-enforced routing to `cortex-update-context` is absent. The doc at `trigger-phrases.md` line 29 says `"we got <X>"` is a resolved trigger, but the hook doesn't implement it.

**11:30 — Client call ends, pastes a 45-line Granola transcript into the chat**

`user-prompt-submit` hook fires. Line count ≥ 20: YES. Speaker count check runs: `grep -cE '^[A-Za-z]+: '`. Granola transcripts export with `**Ben:** text` format (bold names), not `Ben: text`. The speaker regex `^[A-Za-z]+: ` requires no leading asterisks. If the paste is in bold-speaker format, `SPEAKER_COUNT` will be 0, the transcript isn't hard-routed, and the user is left to trigger meeting processing manually. This is not a theoretical edge case — Granola's default export format uses bold speaker labels.

**12:00 — After a break, session is still open. The model has drifted across 10 turns of general chat.**

`activation-levels.md` line 66: "User changes subject to unrelated chat for 3+ turns → L3 → L2." The model should note "(stepping out of FKT focus)" and de-escalate. But this de-escalation logic lives entirely in the model's interpretation of the SKILL.md — no hook enforces it. There's no session-turn counter in any hook. In practice, a model mid-session with a large context will often hold the L3 contract too rigidly (continuing to surface blockers) or too loosely (forgetting project context entirely). Either way, there's no runtime guard.

**14:30 — End of session. Presses Ctrl+C / the session naturally stops.**

`stop` hook fires. Checks `pending-memory.json`. If the model queued any memory updates (e.g., "Ashley is now the primary contact for FKT"), they get flushed to `memory.md`. The stop hook appends to `_changelog.txt` with a hardcoded inline format (line 181–182) as a fallback when `node` is unavailable — but when node IS available and `CLAUDE_PLUGIN_ROOT` is set, it calls `append-changelog-cli.js`. However, the stop hook's `_changelog.txt` append uses the INLINE format directly (line 180–181, not via the shared CLI/MCP path). The `MEMORY_UPDATED` entry format in the stop hook is hardcoded (`[$TIMESTAMP] MEMORY_UPDATED [auto] | FILE: memory.md | DEST: memory.md | ...`) while `changelog-format.js` also defines `MEMORY_UPDATED` as a valid action — these two paths exist in parallel and the stop hook doesn't use the shared formatter. Minimal risk of format drift today, but the architecture is fragile.

---

## Findings

### Finding 1 — "we're going with X" misses the decision-capture hook (P1)

**Area:** capture  
**Evidence:** `hooks/user-prompt-submit` lines 91–98. The bash `case` pattern includes `*"going to go with"*` but NOT `*"we're going with"*` or `*"going with"*`. The `trigger-phrases.md` table row 7 lists `"going to go with"` as the canonical phrase — but developers naturally say "we're going with Rebuy" or "I'm going with the theme approach." A solo dev typing mid-build decisions will almost never phrase it as the canonical trigger exactly.  
**Impact:** Decision-capture hint is not injected by the hook. The decision falls through to model-side ambient capture only (which works at L3 but is not reinforced), and silently fails to trigger at L1/L2 where the hook hint would have been the primary signal.  
**Suggested fix:** Add `*"going with "* | *"we're going with "* | *"i'm going with "* | *"went with "*)` alongside the existing `going to go with` match in the hook's decision-trigger case. Mirror the additions in `trigger-phrases.md` row 7.

---

### Finding 2 — Granola bold-speaker transcripts are not auto-routed (P1)

**Area:** meeting  
**Evidence:** `hooks/user-prompt-submit` lines 61–69. The speaker detection regex is `grep -cE '^[A-Za-z]+: '` — requires `Name: text` at line start. Granola's standard transcript export uses `**Name:** text` (markdown bold). The regex requires no `**` prefix, so the speaker count returns 0 and the structural transcript trigger does not fire. The hook then falls through to explicit-phrase matching (lines 73–79), which also won't match because the user just pasted raw notes.  
**Impact:** The user has to manually type "process this meeting" after pasting a Granola transcript, defeating the "just paste and it routes" promise. This is a daily-use friction point for a user who uses Granola.  
**Suggested fix:** Extend the speaker regex to `'^(\*\*)?[A-Za-z ]+:(\*\*)?\s'` (handles both `Name: ` and `**Name:** ` formats). Also consider detecting `^[A-Za-z ]+:\s` (allows multi-word names like "Ben Hungerford:") since that's the other common Granola format.

---

### Finding 3 — "got the X" / "clearing that blocker" not in hook trigger list (P1)

**Area:** capture  
**Evidence:** `hooks/user-prompt-submit` lines 103–110 (resolved-trigger case): only `*"that's resolved"*|*"blocker resolved"*|*"unblocked"*` are matched. `references/trigger-phrases.md` line 29 documents `"we got <X> (where X is a previously-logged blocker)"` as a resolved trigger, but this is not implemented in the hook. The developer typing "got the Stripe sandbox creds" or "the credentials came through" gets no `<cortex-hint>` injection.  
**Impact:** Blocker-resolution capture relies entirely on L3 ambient watch. In L1/L2 sessions (e.g., user is in a generic terminal, not the project repo), the blocker-resolution intent is completely missed by the hook and likely missed by the model too since there's no escalation signal.  
**Suggested fix:** Add patterns like `*"got the "* | *"clearing that blocker"* | *"that blocker is resolved"* | *"no longer blocked"*` to the resolved-trigger case block in `hooks/user-prompt-submit` (around line 103).

---

### Finding 4 — L3 read-only default creates a silent capture failure mode (P1)

**Area:** capture  
**Evidence:** `references/activation-levels.md` lines 45–49. L3 is "read-only by default" inside a repo session; explicit trigger phrase overrides the default. However, `cortex-boot` SKILL.md step 3 says the opening line for L3 is simply "FKT — Stage. N blockers. Ready." — there is no user-visible notice that writes require an explicit phrase. A solo dev who is in L3, sees the context surfaced, and then mid-build says "we're using Tailwind, not Bootstrap" without prepending "log that" will find the decision silently NOT captured if the ambient watch doesn't flag it as Tier 1.  
**Impact:** For this persona (mid-build decisions are the primary capture mode), the L3 read-only default is the biggest capture silent failure. The developer trusts L3 is "on" but their technical decisions disappear unless they happen to use a literal trigger phrase. There is no warning at session start that the vault is read-only unless a trigger phrase is used.  
**Suggested fix:** In the L3 opening line output (cortex-boot SKILL.md step 3), append a brief read-only reminder: e.g. `"FKT Shopify — Integrations. 2 blockers. Say 'log that' to save decisions."` One line; doesn't break the lightweight boot UX. Alternatively, L3 ambient Tier 1 captures should be enabled for decisions even without a trigger phrase, which aligns with how L2 behaves and is arguably more correct for "Full Project" mode.

---

### Finding 5 — recall_related first-call cold-start latency with no user feedback (P2)

**Area:** recall  
**Evidence:** `mcp-servers/cortex-vault/lib/embeddings.js` lines 13–16. `getExtractor()` lazy-loads `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` on the first call. The model download (first ever use) or cold module load (each MCP server restart) runs synchronously in the async `embed()` path. `cortex-boot` SKILL.md step 6 says to call `recall_related` at the start of a substantive task — this means the very first real task of the session will block on transformer initialization with no spinner or status message visible to the user.  
**Impact:** On first task of the day, the user gets a 1–3 second (warm, subsequent sessions) or potentially 10–30 second (first-ever install) pause before the response arrives, with no explanation. The user sees nothing — the call is silent per the SKILL spec. The latency is invisible and looks like Claude hanging.  
**Suggested fix:** Consider a lightweight "warming" call at session-start (fire-and-forget embedding of a constant string to pre-load the transformer), or surface a `(loading recall engine…)` indicator in the L3 boot line when the DB is cold (detectable by checking `.cortex/search.db` mtime vs. `personality.md` mtime).

---

### Finding 6 — post-tool-use changelog double-write when node is available (P2)

**Area:** hooks  
**Evidence:** `hooks/post-tool-use` lines 181–192. The hook uses `append-changelog-cli.js` when `$PLUGIN_ROOT_FOR_CLI` and `node` are available (line 185), and falls back to a hardcoded inline `echo` otherwise. The stop hook at lines 178–181 also directly writes to `_changelog.txt` with a hardcoded format string rather than going through the CLI or MCP tool. `mcp-servers/cortex-vault/lib/changelog-format.js` is the stated "single source of truth" (line 6), but the stop hook bypasses it. The post-tool-use hook correctly uses the CLI path when node is present, but if `CLAUDE_PLUGIN_ROOT` is unset (e.g., a user running Claude Code without the env var populated), it silently falls back to the inline format which lacks the normalized tag structure.  
**Impact:** On machines where `CLAUDE_PLUGIN_ROOT` is not set (e.g., installed via `install-cli.sh` but invoked from a custom shell profile that doesn't export it), post-tool-use entries in `_changelog.txt` use a slightly different format from MCP-tool entries. `boot-context.py`'s `read_changelog` tail-reader is line-based so it still works, but downstream parsers relying on the `| FILE: ... | DEST: ...` split structure could fail on entries that omit the `[auto]` tag or use a different timestamp format.  
**Suggested fix:** The stop hook should call `append-changelog-cli.js` too (same guard as post-tool-use), or the fallback inline format should be `formatChangelogEntry`-equivalent. Extract the format to a shared bash function in a `hooks/lib/` helper so both hooks can stay in sync without Node.

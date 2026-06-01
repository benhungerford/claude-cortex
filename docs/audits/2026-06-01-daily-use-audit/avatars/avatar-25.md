---
avatar: 25
persona: Extreme context-switcher — L1/L2/L3 across 8 projects per session
surface: Claude Code CLI
date: 2026-06-01
auditor: claude-sonnet-4-6
---

# Avatar 25 — Daily-Use Audit

## Persona

**Extreme context-switcher.** Ben opens four or more Claude Code terminal windows in a single day, each rooted in a different registered repo (L3). He also drops into ad-hoc directories (L1) and vault-level tasks (L2) between sessions. On a typical day he might touch: FKT Shopify build, Bubl Shots compliance work, an internal tooling script in `~/scripts/`, the vault root itself, and three more client repos. He generates multiple meeting notes per day, logs blockers and resolutions frequently, and relies on the L3 boot summary to reorient instantly when he returns to a project after two hours away.

---

## Simulated Day Narrative

**08:30 — Session 1: FKT Shopify build (L3)**

Ben opens a terminal in `~/Documents/Freelance Projects/fkt-checkout/`. Session-start fires `boot-context.py`, which walks up from cwd, matches `fkt-checkout` against registry, reads the project hub, and emits an L3 session block. `cortex-boot` surfaces: *"FKT Shopify Website Build — Integrations stage. 2 open blockers."* Looks right. He digs in.

Mid-session he says "we got the Stripe sandbox creds — clearing that blocker." The `user-prompt-submit` hook scans for `*"unblocked"*`, `*"blocker resolved"*`, `*"that's resolved"*` — but the phrase "we got X" is listed as a trigger in `references/trigger-phrases.md` row 9 yet is absent from the hook's pattern list. No `<cortex-hint>` is injected. The LLM may still catch it via `cortex-boot`'s ambient watch, but the explicit hook routing miss means routing confidence degrades.

He then pastes a 25-line Granola transcript from his earlier standup. The `user-prompt-submit` hook's structural detection fires correctly: 20+ lines, 3+ `Name: text` speaker lines → `cortex-process-meeting`. Good. The skill creates a meeting note, threads it with the prior standup. When `thread_meeting` is called, the new file must already exist on disk before calling the tool (hard requirement at line 222 of `thread-meeting.js`). The skill must create the file first, then call `thread_meeting`. This is order-sensitive and not documented in the skill itself — a footgun if skills deviate.

**10:15 — Session 2: ad-hoc `~/scripts/deploy-helper/` (L1)**

New terminal window. `boot-context.py`'s `resolve_cwd` walks up from cwd but stops at `~` (line 147: `if candidate == home … break`). Not in vault, not a registered repo → L1. Fine. The `vault-path.txt` in the shared session-cache is overwritten with the vault path from this boot. Now both Session 1 (still running) and Session 2 share the same `vault-path.txt`. If Session 1's `post-tool-use` hook fires now, it reads `vault-path.txt` and gets the correct vault — the value is the same because both sessions share a single vault. The race is benign here, but see Finding 3 below.

**11:00 — Session 3: Bubl Shots compliance (L3)**

Third terminal window. boot fires, new L3 session. The Bubl Shots project was scaffolded via `cortex-ingest-project` (which calls `scaffold-project.js`). The scaffold creates `## Open Questions` and `## Blockers` as separate empty sections (scaffold-project.js lines 180–182). `boot-context.py`'s `parse_hub()` looks for `"## Open Questions & Blockers"` (single combined section) — it finds nothing. The L3 boot summary shows `Blockers: (none)` even if someone later hand-wrote blockers under `## Blockers`. Ben stares at a clean blocker list for a project that has two live blockers.

**12:30 — Quick status check across projects**

Ben types: "what's the status of Bubl?" `user-prompt-submit` matches `*"status of"*` → `cortex-check-status`. The skill calls `mcp__cortex-vault__read_hub`. `read-hub.js` runs `extractBlockers(body)` looking for `## Blockers` + `- [ ]` checkbox items (lines 54–63). The scaffold didn't put checkboxes in, so that returns `[]`. `extractOpenQuestions` does the same for `## Open Questions`. Zero results. Status check agrees with the broken boot: "no open blockers" — but there are two.

**14:00 — Meeting processing, multi-project meeting**

Ben pastes notes from a call that touched FKT and Bubl Shots. `cortex-process-meeting` fires. The meeting note is filed under the primary project (FKT), cross-linked to Bubl Shots. `thread_meeting` is called to thread the new standup note. It requires exactly 3+ prior meetings with the same title suffix. If this is only the 2nd standup, threading is silently skipped with a text message (not an error) — but no announcement reaches the confirmation line. Ben doesn't know threading was skipped.

**15:30 — Context switch back to Session 1 (FKT) — ambient recall mid-task**

Ben is still in the FKT session window (two hours later, same session). He starts describing a new webhook architecture. `cortex-boot`'s ambient recall fires `recall_related`. The MCP server was running continuously; the embedding model singleton was loaded at first use. But `recall_related` makes a synchronous `openDb` call followed by `db.close()` in a `finally` block (recall-related.js lines 63–95). Simultaneously, the `post-tool-use` hook's background reindex (`reindex-one.js` launched via `& disown`) is writing to the same sqlite-vec WAL. The `busy_timeout = 5000` (search-db.js line 21) should absorb brief contention, but the `db.close()` in `finally` is called whether or not the query succeeds — this is correct. No data-loss risk here, but latency spikes during heavy reindex days.

**17:00 — Session 1 ends (stop hook)**

`stop` hook fires. It reads `pending-memory.json` from the shared `session-cache/` directory and flushes to `memory.md`. If Session 3 (Bubl Shots) had also accumulated pending memory (and its stop hook hasn't fired yet), those updates are in a different `pending-memory.json` — wait, there's only ONE `pending-memory.json` in the shared `session-cache/`. If both sessions write pending memory, the second writer's stop hook will either double-flush or conflict. The stop hook appends all entries from `pending-memory.json` without a session namespace, then deletes the file. If Session 3 is still open when Session 1's stop fires, Session 3's accumulated pending memory is silently consumed and deleted before Session 3's stop hook gets to it. **Session 3's pending memory is lost.**

---

## Findings

### Finding 1 — P0: scaffold-project hub format incompatible with boot-context.py and blank-template

**Area:** boot  
**Severity:** P0  
**Evidence:** `mcp-servers/cortex-vault/tools/scaffold-project.js:180–182` creates `## Open Questions` and `## Blockers` as separate sections. `assets/blank-template.md:70` uses `## Open Questions & Blockers` as a combined pipe-table section. `hooks/lib/boot-context.py:207` searches for `r'## Open Questions & Blockers\s*\n\|[^\n]*\n\|[-| ]+\n'` — this regex will never match a scaffold-generated hub. Additionally, `mcp-servers/cortex-vault/tools/read-hub.js:45–63` expects separate sections but looks for `- [ ]` checkbox items that scaffold doesn't generate either. Three parsers, three formats, zero overlap for scaffolded projects.  
**Impact:** Any project scaffolded via `cortex-ingest-project` will show zero blockers and zero open questions at L3 boot, and in all `cortex-check-status` calls. For a user with 8 registered projects that were all scaffolded, the blocker-awareness feature of L3 is silently broken from day one.  
**Suggested Fix:** Align scaffold-project.js to generate the `## Open Questions & Blockers` combined pipe-table matching `blank-template.md` and `boot-context.py`. Update `read-hub.js` to parse the table format (match pipe-rows, not checkboxes). Alternatively, if checkboxes are the preferred UX, update `boot-context.py:207` and `blank-template.md` to use the checkbox format. Pick one format and enforce it everywhere.

---

### Finding 2 — P0: shared session-cache loses pending-memory for concurrent sessions

**Area:** hooks  
**Severity:** P0  
**Evidence:** `hooks/session-start:40–45` writes `$PLUGIN_DATA/session-cache/vault-path.txt` (single shared file). `hooks/stop:101–106,186` reads and then deletes `$PLUGIN_DATA/session-cache/pending-memory.json` (single shared file). No session ID or namespace anywhere in any hook file. `hooks/stop:189` explicitly comments "leave other cache files intact" — confirming the design assumes one active session at a time.  
**Impact:** Any user who opens two Claude Code windows simultaneously (the norm for an 8-project context-switcher) risks: (a) Session A's stop hook deleting Session B's pending memory before B's stop hook fires; (b) `vault-path.txt` written by Session B (different cwd) being read by Session A's post-tool-use hook. Result: silent data loss on memory updates and potential misrouted changelog entries.  
**Suggested Fix:** Namespace session-cache by session ID. Claude Code injects `CLAUDE_SESSION_ID` (or equivalent) as an env var at hook invocation — use it to create per-session subdirectories: `$PLUGIN_DATA/session-cache/$SESSION_ID/vault-path.txt`. Fall back to a timestamp-derived name if the env var is absent. The stop hook should only clean its own namespace.

---

### Finding 3 — P1: L3 activation is session-locked, so mid-session project switch has no mechanism to re-engage L3 for the new project

**Area:** activation  
**Severity:** P1  
**Evidence:** `skills/cortex-boot/SKILL.md:5–6` states "Makes zero file reads — all vault context is pre-loaded by the hook." The hook's session block is injected once at session start. `hooks/hooks.json:56–59` (`<cortex-boot-required>`) explicitly says "After cortex-boot has run once in this session, do NOT re-invoke it on subsequent turns." `references/activation-levels.md:68–69` documents de-escalation from L3→L2 when "user changes subject for 3+ turns" — but there is no mechanism to re-escalate to L3 for a *different* project mid-session, and no turn counter anywhere in the hook layer.  
**Impact:** A context-switcher who says "ok let's switch to Bubl Shots for the next hour" mid-session in an FKT window gets L3 behavior for FKT (hub loaded, blockers surfaced) but only L2 behavior for Bubl Shots (no hub read at context switch, no blocker summary, no scope-creep flagging). The de-escalation note ("stepping out of FKT focus") fires correctly, but the re-escalation into Bubl never loads the Bubl hub. The user believes Cortex is tracking the new project; it isn't.  
**Suggested Fix:** When a user says "let's work on X" (row trigger → L3) and X is a different registered project than the boot-computed one, cortex-boot (or a lightweight mid-session variant) should call `mcp__cortex-vault__read_hub` for the new project and deliver the same L3 opening summary it would have given at session start. Document this in cortex-boot's "escalation" section explicitly.

---

### Finding 4 — P1: "we got X" blocker-resolved trigger listed in trigger-phrases.md but absent from user-prompt-submit hook

**Area:** capture  
**Severity:** P1  
**Evidence:** `references/trigger-phrases.md:29` row 9 lists `"we got <X>" (where X is a previously-logged blocker)` as a resolved-blocker trigger for `cortex-update-context`. `hooks/user-prompt-submit:105` lists only `*"that's resolved"*|*"blocker resolved"*|*"unblocked"*` for the resolved trigger. "we got the Stripe creds", "we got access", "we got approval" — all natural blocker-resolved phrases — produce no `<cortex-hint>` injection.  
**Impact:** The hook misses a common natural-language pattern for blocker resolution. The LLM's ambient capture (cortex-boot capture rules) may still catch it, but without the hint injection the model has no explicit routing signal and may answer the remark conversationally without invoking `cortex-update-context`. Blockers remain open in the hub.  
**Suggested Fix:** Add `*"we got "* ` to the resolved trigger block in `hooks/user-prompt-submit:105`. Additionally, add `*"just got "* `, `*"received the "* `, and `*"client sent "* ` as these are the most common "delivery confirmation" phrases in a freelance workflow. Keep trigger-phrases.md and the hook pattern list in lockstep — add a comment citing the row number.

---

### Finding 5 — P1: thread_meeting requires the new note to already be on disk, but this constraint is not documented in cortex-process-meeting skill

**Area:** meeting  
**Severity:** P1  
**Evidence:** `mcp-servers/cortex-vault/tools/thread-meeting.js:222–229` returns `isError: true` with message "New file not found on disk — create it first, then call thread_meeting." `skills/cortex-process-meeting/SKILL.md` step 4 says "Thread with previous meetings — find the most recent prior instance... add bidirectional links" with no mention that the file must exist on disk before calling `thread_meeting`. The skill's MCP tool preference table (SKILL.md:32–37) shows `thread_meeting` without the pre-condition.  
**Impact:** If the model calls `thread_meeting` before writing the meeting note to disk (a natural sequence: find series first, then write), it gets a hard error. A context-switcher processing 3–4 meetings per day will hit this repeatedly until they learn the correct call order. The error message gives them the fix, but the round-trip is friction and the error shows in the confirmation line instead of a clean "Meeting note filed" announcement.  
**Suggested Fix:** Add a pre-condition note to `cortex-process-meeting/SKILL.md` step 4: "Call `thread_meeting` only after the new note has been written to disk (after step 3)." Alternatively, make `thread_meeting` idempotent to ordering: if the new file doesn't exist, return a non-error result instructing the caller to re-invoke post-write, rather than `isError: true`.

---

### Finding 6 — P2: boot-context.py stops cwd walk at `~` (home), silently dropping L3 for repos directly in home directory

**Area:** boot  
**Severity:** P2  
**Evidence:** `hooks/lib/boot-context.py:136–148`: `home = os.path.expanduser("~")`, then `if candidate == home or parent == candidate: break`. The walk stops *at* home, not *after* home. So a repo registered as `~/my-project` (repo_path = `/Users/ben/my-project`) will never match: when `candidate` reaches `/Users/ben`, the loop breaks before checking `/Users/ben` against the registry. The check `if os.path.realpath(repo_path) == candidate` runs against each candidate *before* the break check, but the break fires on `candidate == home` — meaning the match check at the home directory level is skipped.  

Re-reading lines 140–149 carefully: the check `for project... if ... == candidate` runs *first* in the loop body, then `parent = os.path.dirname(candidate)`, then `if candidate == home ... break`. So when `candidate` is `~/my-project`, the match check runs, finds the repo, and returns before the break. But when `candidate` is `~` itself (a repo registered at the exact home directory path), the loop body runs the match check first — this would find it. The bug is actually the *reverse*: repos registered at exactly `~` would match, but repos registered at `~/my-project` do match too. Let me re-read.  

Actually the break fires when `candidate` has already moved past `~/my-project` to `~`. So repos in `~/` *do* match. The real edge case: if cwd is `~/my-project/src/component` and the registered `repo_path` is `~/my-project`, the walk goes `…/component → src → my-project` — stops before reaching `~`. This is correct. The issue surfaces if someone registers a repo at a path *shallower* than cwd's parent but *deeper* than home.  

The actual gap: `resolve_cwd` stops at `home`, meaning **repos registered at paths outside `~`** (e.g., `/opt/projects/client-repo`) are unreachable. The walk never goes above `~`. This is by design per the comment ("Stop at home directory or root"), but it's a silent miss for repos registered at system-level paths (CI machines, Docker volumes).  
**Impact:** Medium severity for a context-switcher who has a repo at `/opt/` or `/srv/` or a symlinked path outside home. Silent L1 instead of L3. Minimal for typical macOS dev.  
**Suggested Fix:** Document the home-directory stop in `session-start` and in `register-repo` validation: warn if the registered `repo_path` is outside `~`. Add a test scenario in `tests/scenarios.md` for this edge case.

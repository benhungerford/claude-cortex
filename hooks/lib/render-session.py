#!/usr/bin/env python3
"""Render boot-context.py JSON (stdin) as the <cortex-session> block (stdout).

Called by hooks/session-start. The block is plain facts plus a few lines on
how to act on them; it replaced the cortex-boot skill in 2.0.0. If you change
the fixed text here, keep RENDER_OVERHEAD_CHARS in boot-context.py roughly in
step with it.

Usage:
  render-session.py <plugin_root> < boot.json   render and print the hook JSON
  render-session.py --wrap < text               wrap a ready-made block as hook JSON

The hook JSON is written with json.dumps, so control characters in vault text
(ESC, BEL...) are escaped and the output is always valid JSON. The output is
hard-capped at the JSON's budget_chars, whatever the hub or vault contains.
"""

import json
import os
import sys

MAX_BLOCKERS_SHOWN = 5  # keep in step with boot-context.py

LEVEL_NAMES = {1: "L1 — Passive", 2: "L2 — Vault-Aware", 3: "L3 — Full Project"}

LEVEL_GUIDE = {
    1: "L1: answer the user directly and don't mention Cortex.",
    2: "L2: stay quiet unless a stale blocker or urgent inbox item is worth one line.",
    3: "L3: open your first reply with one line (project, stage, blocker count) and "
       "add \"(say 'log that' to capture decisions)\" that once.",
}


def render(data, plugin_root):
    level = data.get("activation_level")
    if level not in LEVEL_NAMES:
        level = 1
    refs = os.path.join(plugin_root, "references")
    out = ["<cortex-session>", f"Claude Cortex vault: {data['vault_path']}",
           f"Level: {LEVEL_NAMES[level]}"]

    p = data.get("project")
    if level == 3 and p:
        out.append(f"Project: {p.get('name') or p.get('id')} ({p.get('vault_path', '')})")
        if p.get("stage"):
            out.append(f"Stage: {p['stage']}")
        # Counts come from parse_hub before any budget trimming.
        n_blk = p.get("blocker_count", len(p.get("blockers") or []))
        n_oq = p.get("open_question_count", len(p.get("open_questions") or []))
        shown = (p.get("blockers") or [])[:MAX_BLOCKERS_SHOWN]
        if n_blk:
            more = f"; +{n_blk - len(shown)} more (read_hub)" if n_blk > len(shown) else ""
            out.append(f"Blockers ({n_blk}): {'; '.join(shown)}{more}")
        if n_oq:
            out.append(f"Open questions: {n_oq}")
        parsed = p.get("parsed") or {}
        missing = [k for k in ("stage", "blockers") if parsed and not parsed.get(k)]
        if p.get("hub_missing"):
            out.append("Hub: not found or unreadable; call read_hub, or check the "
                       "project's registry entry.")
        elif missing:
            out.append(f"{' and '.join(missing).capitalize()}: not parsed from the hub; "
                       "call read_hub for them.")
        if p.get("recent_decisions"):
            # boot-context.py lists these newest first.
            out.append("Recent changelog entries, newest first: " + "; ".join(
                d if len(d) <= 200 else d[:199].rstrip() + "…"
                for d in p["recent_decisions"][:3]))
    else:
        if p and p.get("default"):
            out.append(f"Default project: {p.get('name') or p.get('id')} ({p.get('vault_path', '')})")
        if data.get("active_projects"):
            out.append(f"Active projects: {data['active_projects']}")
    out.append(f"Inbox: {data.get('inbox_count', 0)} unsorted item(s)")
    if data.get("activation_warning"):
        out.append(f"Note: {data['activation_warning']}")

    out += [
        "",
        "How to use this:",
        f"- {LEVEL_GUIDE[level]} Don't recap this block; treat it as background. "
        f"Don't step up a level past what the user asked for ({refs}/activation-levels.md "
        "covers moving between levels).",
        f"- Capture decisions, blockers and preferences as {refs}/capture-rules.md "
        "describes. An explicit \"log that\" or \"we decided\" writes straight away; "
        "at L3 an inferred capture gets a one-line confirm first.",
        "- When the user starts a real task, names a tool or vendor, or hits a blocker, "
        "call recall_related once that turn (limit 5; at L3 pass the project path as "
        "scope; pass the file being edited in exclude_paths). Mention a hit in one line "
        "with its project, or say nothing if none clear the score floor. Skip it for "
        "small talk.",
        "- For full detail, use read_hub or search_vault, Read memory.md at the line "
        "ranges below, or Read personality.md.",
    ]
    if data.get("feature_suggestion"):
        out.append(f"- At a natural pause (not now), offer once: {data['feature_suggestion']}")

    if data.get("personality"):
        out += ["", "Profile (summary of personality.md):", data["personality"].rstrip()]
    if data.get("memory"):
        out += ["", data["memory"].rstrip()]
    if (data.get("learner_profile") or "").strip():
        out.append("Coaching profile: Knowledge Base/Growth/_profile.md (read it for /cortex-coach).")
    if data.get("recent_activity"):
        out += ["", "Recent vault activity (_changelog.txt):", data["recent_activity"]]

    b = data.get("_budget")
    if b and b.get("truncated"):
        out.append(f"Trimmed to fit the {b.get('limit_chars')}-char budget: "
                   f"{', '.join(b['truncated'])}.")
    out.append("</cortex-session>")
    return "\n".join(out)


def wrap(text):
    """The hook's stdout JSON for this runtime (Cursor, Claude Code, other)."""
    if os.environ.get("CURSOR_PLUGIN_ROOT"):
        obj = {"additional_context": text}
    elif os.environ.get("CLAUDE_PLUGIN_ROOT") and not os.environ.get("COPILOT_CLI"):
        obj = {"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": text}}
    else:
        obj = {"additionalContext": text}
    return json.dumps(obj, ensure_ascii=False)


TRIM_NOTE = "\n[Trimmed to fit the context budget; use read_hub or search_vault for more.]\n</cortex-session>"


def capped_output(text, limit):
    """wrap(text), cut so the whole JSON line is at most `limit` chars."""
    out = wrap(text)
    if not limit or limit <= 0 or len(out) <= limit:
        return out
    body = text[: -len("</cortex-session>")] if text.endswith("</cortex-session>") else text
    keep = len(body)
    while keep > 0:
        keep -= max(len(out) - limit, 16)
        out = wrap(body[:max(keep, 0)].rstrip() + TRIM_NOTE)
        if len(out) <= limit:
            break
    return out


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--wrap":
        print(wrap(sys.stdin.read().rstrip("\n")))
        return
    plugin_root = sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(
        os.path.dirname(os.path.abspath(__file__)))
    data = json.loads(sys.stdin.read())
    print(capped_output(render(data, plugin_root), data.get("budget_chars")))


if __name__ == "__main__":
    main()

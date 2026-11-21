#!/usr/bin/env python3
"""Boot context loader for Claude Cortex session-start hook.

Reads vault files, resolves cwd to a project, computes activation level,
and outputs structured JSON to stdout. Called by hooks/session-start.

Exit codes:
  0 — success, JSON on stdout
  3 — not set up: config.json is absent, or the vault is readable and has no
      personality.md. session-start offers onboarding.
  4 — set up but unreadable: config.json will not parse or has no vault_path,
      the vault dir is missing or unreadable (unmounted drive, iCloud, macOS
      permission), or personality.md can't be read. A one-line JSON
      {"error", "vault_path", "reason"} goes to stdout; session-start says the
      vault could not be read and does not offer onboarding.
  Any other non-zero exit is a crash; session-start stays silent.
"""

import argparse
import json
import os
import re
import subprocess
import sys


def read_config(config_path):
    """Read vault_path from config.json. Returns path string or None."""
    try:
        with open(config_path, encoding="utf-8") as f:
            config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    vault_path = config.get("vault_path", "")
    if not vault_path or not os.path.isdir(vault_path):
        return None
    return vault_path


NOT_SET_UP = 3
UNREADABLE = 4


def check_setup(config_path):
    """Decide whether boot can go on. Returns (vault_path, personality, None)
    on success, or (vault_path_or_None, None, (exit_code, reason)).

    Only a missing config.json or a readable vault with no personality.md
    counts as "not set up". Everything else that goes wrong is "unreadable",
    so an existing user is never offered onboarding (which would build a new
    vault and rewrite config.json) because a drive is unmounted or a file was
    caught mid-write.
    """
    if not os.path.exists(config_path):
        return None, None, (NOT_SET_UP, "no config.json")
    try:
        with open(config_path, encoding="utf-8") as f:
            config = json.load(f)
    except (OSError, json.JSONDecodeError, UnicodeDecodeError) as e:
        return None, None, (UNREADABLE, f"config.json could not be read ({type(e).__name__})")
    vault_path = config.get("vault_path") if isinstance(config, dict) else None
    if not vault_path or not isinstance(vault_path, str):
        return None, None, (UNREADABLE, "config.json has no vault_path")
    if not os.path.isdir(vault_path):
        return vault_path, None, (UNREADABLE, "vault folder not found (drive unmounted or moved?)")
    try:
        os.listdir(vault_path)
    except OSError as e:
        return vault_path, None, (UNREADABLE, f"vault folder not readable ({type(e).__name__})")
    path = os.path.join(vault_path, "personality.md")
    if not os.path.lexists(path):
        return vault_path, None, (NOT_SET_UP, "no personality.md")
    if not os.path.isfile(path):
        return vault_path, None, (UNREADABLE, "personality.md is not a regular file")
    try:
        with open(path, encoding="utf-8") as f:
            personality = f.read()
    except (OSError, UnicodeDecodeError) as e:
        return vault_path, None, (UNREADABLE, f"personality.md could not be read ({type(e).__name__})")
    if not personality.strip():
        # An empty file is more likely a sync placeholder or a bad write than
        # a fresh install, so don't send the user to onboarding.
        return vault_path, None, (UNREADABLE, "personality.md is empty")
    return vault_path, personality, None


def read_config_budget(config_path):
    """Read optional budget_chars from config.json. Returns int or None."""
    try:
        with open(config_path, encoding="utf-8") as f:
            config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    val = config.get("budget_chars")
    return val if isinstance(val, int) else None


def read_config_default_project(config_path):
    """Read optional default_project (a registry project id) from config.json.

    Set during onboarding or via /set-default-project. Lets shell-less or
    cwd-less sessions (Cowork Desktop, iPad) escalate to at least L2 instead of
    being stuck at L1 all day with no project anchor. Returns str or None.
    """
    try:
        with open(config_path, encoding="utf-8") as f:
            config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return None
    val = config.get("default_project")
    return val if isinstance(val, str) and val else None


def read_personality(vault_path):
    """Read personality.md. Returns content string or None if missing."""
    path = os.path.join(vault_path, "personality.md")
    if not os.path.isfile(path):
        return None
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except (OSError, UnicodeDecodeError):
        return None


def read_memory(vault_path, cap=100):
    """Read memory.md, tail-capped at cap lines. Returns string."""
    path = os.path.join(vault_path, "memory.md")
    if not os.path.isfile(path):
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.readlines()
    except (OSError, UnicodeDecodeError):
        return ""
    if len(lines) > cap:
        lines = lines[-cap:]
    return "".join(lines)


def summarize_memory(vault_path, cap=100):
    """Summarize memory.md for the session block.

    A sectioned memory.md (has `## ` headings) becomes a table of contents with
    line ranges, so Claude can Read just the section a task needs. The tail of a
    long, sectioned memory file is usually an old session log, not the facts
    that matter. A memory.md with no `## ` headings falls back to the tail-capped
    text (read_memory).
    """
    path = os.path.join(vault_path, "memory.md")
    if not os.path.isfile(path):
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            lines = f.read().split("\n")
    except (OSError, UnicodeDecodeError):
        return ""
    if lines and lines[-1] == "":
        lines.pop()
    heads = [(i + 1, l[3:].strip()) for i, l in enumerate(lines) if l.startswith("## ")]
    if not heads:
        return read_memory(vault_path, cap)
    total = len(lines)
    rows = []
    for n, (start, title) in enumerate(heads):
        end = heads[n + 1][0] - 1 if n + 1 < len(heads) else total
        subs = sum(1 for l in lines[start:end] if l.startswith("### "))
        extra = f", {subs} entries" if subs else ""
        rows.append(f"- {title[:80]} (lines {start}-{end}{extra})")
    return f"memory.md has {total} lines. Sections:\n" + "\n".join(rows)


def _frontmatter(content):
    m = re.search(r'^---\s*\n(.*?)\n---', content or "", re.DOTALL)
    return m.group(1) if m else ""


def _top_block(fm, key):
    """Lines under a top-level YAML key, up to the next top-level key."""
    out, inside = [], False
    for line in fm.split("\n"):
        if re.match(rf'^{re.escape(key)}:\s*$', line):
            inside = True
            continue
        if inside:
            if line and not line[0].isspace():
                break
            out.append(line)
    return out


def _scalar(lines, key):
    for line in lines:
        m = re.match(rf'^\s*{re.escape(key)}:\s*"?(.*?)"?\s*$', line)
        if m and m.group(1):
            return m.group(1)
    return ""


def summarize_personality(content):
    """Short summary of personality.md: who, vault layout, writing rules.

    Skills that need the full file (buckets, sub_note_types, tools) read
    personality.md themselves; the session block only carries what shapes
    every reply.
    """
    fm = _frontmatter(content)
    if not fm:
        return (content or "").strip()[:600]
    ident = _top_block(fm, "identity")
    model = _top_block(fm, "mental_model")
    parts = []
    who = ", ".join(x for x in (_scalar(ident, "name"), _scalar(ident, "role")) if x)
    org = _scalar(ident, "company")
    if who:
        parts.append(f"User: {who}" + (f" ({org})" if org else "") + ".")
    industry = _scalar(ident, "industry")
    if industry:
        parts.append(f"Work: {industry}.")
    terms = [t for t in (_scalar(model, "bucket_term"), _scalar(model, "project_term")) if t]
    if terms:
        parts.append(f"Vault terms: {' / '.join(terms)}.")
    layout = _scalar(model, "hierarchy_pattern")
    if layout:
        parts.append(f"Layout: {layout}")
    groups, group = {}, ""
    for line in _top_block(fm, "communication_preferences"):
        g = re.match(r'^  (\w+):\s*$', line)
        if g:
            group = g.group(1).replace("_", " ")
            continue
        r = re.match(r'^\s*-\s*rule:\s*"?(.*?)"?\s*$', line)
        item = re.match(r'^\s*-\s*"?([^:"][^"]*?)"?\s*$', line)
        text = r.group(1) if r else (item.group(1) if item else "")
        if text:
            groups.setdefault(group, []).append(text.rstrip("."))
    if groups:
        rendered = []
        for name, items in groups.items():
            body = "; ".join(items) + "."
            rendered.append(body if name in ("", "general") else f"{name.capitalize()}: {body}")
        parts.append(("Writing rules: " + " ".join(rendered))[:700])
    return "\n".join(parts)


def read_learner_profile(vault_path):
    """Read Knowledge Base/Growth/_profile.md. Returns content string or empty."""
    path = os.path.join(vault_path, "Knowledge Base", "Growth", "_profile.md")
    if not os.path.isfile(path):
        return ""
    try:
        with open(path, encoding="utf-8") as f:
            return f.read()
    except (OSError, UnicodeDecodeError):
        return ""


def read_changelog(vault_path, tail=15):
    """Read last N lines of _changelog.txt. Returns (content, total_lines)."""
    path = os.path.join(vault_path, "_changelog.txt")
    if not os.path.isfile(path):
        return "", 0
    try:
        with open(path, encoding="utf-8") as f:
            all_lines = f.readlines()
    except (OSError, UnicodeDecodeError):
        return "", 0
    total = len(all_lines)
    return "".join(all_lines[-tail:]).rstrip("\n"), total


def count_inbox(vault_path):
    """Count .md files in _Inbox/."""
    inbox = os.path.join(vault_path, "_Inbox")
    if not os.path.isdir(inbox):
        return 0
    return sum(1 for f in os.listdir(inbox) if f.endswith(".md"))


def extract_buckets(personality_content):
    """Extract 'Name (Type)' list from personality.md buckets section."""
    fm_match = re.search(r'^---\s*\n(.*?)\n---', personality_content, re.DOTALL)
    if not fm_match:
        return ""
    fm = fm_match.group(1)
    buckets_match = re.search(r'  buckets:\s*\n((?:(?:    | {6,}).*\n)*)', fm)
    if not buckets_match:
        return ""
    entries = re.findall(
        r'-\s+name:\s*"([^"]+)".*?type:\s*"([^"]+)"',
        buckets_match.group(1),
        re.DOTALL,
    )
    return ", ".join(f"{name} ({typ})" for name, typ in entries)


def read_registry(vault_path):
    """Read registry.json. Returns dict with 'projects' list."""
    path = os.path.join(vault_path, ".claude", "cortex", "registry.json")
    try:
        with open(path, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError):
        return {"schema_version": 1, "projects": []}


# ── Path normalization (KEEP IN SYNC with mcp-servers/cortex-vault/lib/registry.js) ──
# Both the Python boot resolver and the Node MCP resolver must compare repo
# paths the SAME way, or a repo opened via a symlink/worktree resolves to L3 in
# one and L1 in the other. The shared rule: realpath() when the path exists
# (collapses symlinks + ".."), else fall back to a plain absolute-normalized
# form so non-existent registry entries still compare deterministically. The
# JS side mirrors this in `safeRealpath` / `normalizePath` — edit both together.
def normalize_path(p):
    """realpath when it exists, else abspath+normpath. Mirror of registry.js."""
    if not p:
        return p
    try:
        return os.path.realpath(p)
    except OSError:
        return os.path.normpath(os.path.abspath(p))


def _match_registry(projects, candidate):
    """Return the project whose repo_paths contains `candidate`, else None."""
    for project in projects:
        for repo_path in project.get("repo_paths", []):
            if normalize_path(repo_path) == candidate:
                return project
    return None


def _walk_up_match(projects, start, home):
    """Walk up from `start`, returning the first registry-matched project."""
    candidate = start
    while candidate and candidate != os.path.dirname(candidate):
        match = _match_registry(projects, candidate)
        if match:
            return match
        parent = os.path.dirname(candidate)
        if candidate == home or parent == candidate:
            break
        candidate = parent
    return None


def resolve_git_main_worktree(cwd):
    """If cwd is inside a linked git worktree, return its MAIN worktree root.

    A linked worktree's `git rev-parse --git-common-dir` points at the main
    repo's `.git` directory; its parent is the main worktree root. Returns the
    normalized main-root path, or None when cwd is not in a git repo / git is
    unavailable / cwd already is the main worktree.
    """
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--git-common-dir"],
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=2,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    common_dir = out.stdout.strip()
    if not common_dir:
        return None
    if not os.path.isabs(common_dir):
        common_dir = os.path.join(cwd, common_dir)
    # common_dir is the main repo's `.git`; its parent is the main worktree root.
    main_root = os.path.dirname(os.path.normpath(common_dir))
    main_root = normalize_path(main_root)
    if main_root == normalize_path(cwd):
        return None  # already the main worktree; nothing new to try
    return main_root


def resolve_cwd(vault_path, cwd, registry, default_project=None):
    """Resolve cwd to an activation level and optional project entry.

    Returns (level: int, project_entry: dict | None).
    Level 3 = cwd matches a registered repo (directly, via symlink, or via a
              git worktree whose main root is registered).
    Level 2 = cwd is inside the vault, OR a default_project is configured.
    Level 1 = neither.
    """
    cwd_real = normalize_path(cwd)
    vault_real = normalize_path(vault_path)
    is_inside_vault = (
        cwd_real == vault_real or cwd_real.startswith(vault_real + os.sep)
    )

    home = normalize_path(os.path.expanduser("~"))
    projects = registry.get("projects", [])

    # 1. Exact walk-up match from cwd.
    match = _walk_up_match(projects, cwd_real, home)
    if match:
        return 3, match

    # 2. Exact walk-up failed — if cwd is in a linked git worktree, retry from
    #    the MAIN worktree root (which is what register-repo stores).
    main_root = resolve_git_main_worktree(cwd_real)
    if main_root:
        match = _walk_up_match(projects, main_root, home)
        if match:
            return 3, match

    if is_inside_vault:
        return 2, None

    # 3. No cwd match and not inside the vault. If a default_project is set
    #    (Desktop/iPad with no meaningful cwd), anchor to it at L2 so the
    #    session isn't stuck at L1 with no project context.
    if default_project:
        for project in projects:
            if project.get("id") == default_project:
                return 2, project

    return 1, None


def detect_nearby_cortex(cwd):
    """Warn when L1 is computed but a Cortex stub / vault marker sits nearby.

    Helps users self-diagnose the common "why am I stuck at L1 in my repo?"
    case — usually an unregistered repo that already carries a Cortex stub
    CLAUDE.md, or a vault marker. Returns a one-line warning string or None.
    """
    try:
        cwd_real = normalize_path(cwd)
    except Exception:
        return None
    candidate = cwd_real
    home = normalize_path(os.path.expanduser("~"))
    depth = 0
    while candidate and candidate != os.path.dirname(candidate) and depth < 6:
        claude_md = os.path.join(candidate, "CLAUDE.md")
        if os.path.isfile(claude_md):
            try:
                with open(claude_md, encoding="utf-8") as f:
                    head = f.read(600)
                if "cortex" in head.lower():
                    return (
                        "A Cortex stub CLAUDE.md is nearby, so this repo may not be registered. "
                        "If the user asks about this repo, offer /cortex-register-repo "
                        "to link it for L3 context."
                    )
            except (OSError, UnicodeDecodeError):
                pass
        # $HOME/.claude/cortex is the config dir every install has, not a
        # vault marker, so the home directory is skipped for this check.
        if candidate != home and os.path.isdir(os.path.join(candidate, ".claude", "cortex")):
            return (
                "A Cortex vault marker is nearby. If the user asks about this repo, "
                "offer /cortex-register-repo to link it for full context."
            )
        parent = os.path.dirname(candidate)
        if candidate == home or parent == candidate:
            break
        candidate = parent
        depth += 1
    return None


def cap_text(text, limit):
    """Cut a single line to about `limit` chars, ending with an ellipsis."""
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def parse_hub(vault_path, project_entry):
    """Parse a project context hub for stage, blockers, open questions, decisions.

    Returns dict with keys: stage, blockers, open_questions, recent_decisions.
    Returns None if the hub file doesn't exist.
    """
    hub_path = os.path.join(
        vault_path,
        project_entry["vault_path"],
        project_entry["context_file"],
    )
    if not os.path.isfile(hub_path):
        return None

    try:
        # errors="replace": a stray non-UTF-8 byte shouldn't hide the whole hub.
        with open(hub_path, encoding="utf-8", errors="replace") as f:
            content = f.read()
    except OSError:
        return None

    result = {
        "stage": None,
        "blockers": [],
        "open_questions": [],
        "recent_decisions": [],
        # Which hub sections were found. render-session.py says "call
        # read_hub" for a missing one instead of showing empty data.
        "parsed": {"stage": False, "blockers": False},
    }

    # Parse Stage Tracker table. Headings may carry an emoji or prefix
    # ("## 📦 Project Stage Tracker") and status cells may carry one too
    # ("🟡 In Progress").
    stage_section = re.search(
        r'^## [^\n]*Stage Tracker[^\n]*\n\s*\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n?)*)',
        content,
        re.MULTILINE,
    )
    if stage_section:
        result["parsed"]["stage"] = True
        rows = stage_section.group(1).strip().split("\n")
        # First pass: look for "In Progress" or "Current"
        for row in rows:
            cells = [c.strip() for c in row.split("|")[1:-1]]
            if len(cells) >= 2 and ("In Progress" in cells[1] or "Current" in cells[1]):
                result["stage"] = cap_text(cells[0], 80)
                break
        # Fallback: last row with non-empty, non-"Not Started" status
        if not result["stage"]:
            for row in reversed(rows):
                cells = [c.strip() for c in row.split("|")[1:-1]]
                if len(cells) >= 2 and cells[1] and "Not Started" not in cells[1]:
                    result["stage"] = cap_text(cells[0], 80)
                    break

    # Parse Open Questions & Blockers table (heading may carry an emoji).
    oq_section = re.search(
        r'^## [^\n]*Open Questions & Blockers\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)',
        content,
        re.MULTILINE,
    )
    if oq_section:
        result["parsed"]["blockers"] = True
        rows = oq_section.group(1).strip().split("\n")
        for row in rows:
            cells = [c.strip() for c in row.split("|")[1:-1]]
            if len(cells) < 5:
                continue
            question = cells[1]
            typ = cells[2]
            status = cells[4]
            if not question or status.lower() == "resolved":
                continue
            if typ in ("Dependency", "Internal", "Unknown"):
                result["blockers"].append(cap_text(question, 160))
            else:
                result["open_questions"].append(cap_text(question, 160))

    # Hub-format list sections (.claude/rules/hub-format.md in Ben's vault):
    #   ## Active Blockers
    #   - **BLK-02** · opened 2026-04-10 · blocks: Launch · Awaiting credentials
    #   ## Open Questions
    #   - [ ] **OQ-13** · 2026-04-15 · Sage webhook auth model?
    blk = _section_lines(content, "Active Blockers")
    if blk is not None:
        for line in blk:
            m = re.match(r'^\s*-\s+\*\*(BLK-[\w-]+)\*\*(.*)$', line)
            if not m:
                continue
            # Only a section with BLK ids counts as parsed; a table or loose
            # bullets would otherwise read as "0 blockers".
            result["parsed"]["blockers"] = True
            if re.search(r'\*\*resolved|\bresolved \d{4}-\d{2}-\d{2}|^\s*~~',
                         m.group(2), re.IGNORECASE):
                continue
            fields = [f.strip() for f in re.split(r'\s[·|]\s', m.group(2)) if f.strip()]
            desc = [f for f in fields if not re.match(
                r'^(opened|last-touched)\s|^(blocks|attributable-to):|^self-gate$', f, re.IGNORECASE)]
            text = " · ".join(desc).strip(" ·") or m.group(1)
            result["blockers"].append(cap_text(f"{m.group(1)}: {text}", 160))
    oq = _section_lines(content, "Open Questions", exact=True)
    if oq is not None:
        for line in oq:
            if re.match(r'^\s*-\s+\[ \]\s+', line):
                result["open_questions"].append(cap_text(re.sub(r'^\s*-\s+\[ \]\s+', '', line), 160))

    # Recent decisions from project Changelog.md, newest first.
    changelog_path = os.path.join(
        vault_path, project_entry["vault_path"], "Changelog.md"
    )
    if os.path.isfile(changelog_path):
        try:
            with open(changelog_path, encoding="utf-8", errors="replace") as f:
                text = f.read()
            result["recent_decisions"] = [
                cap_text(l, 200) for l in recent_changelog_entries(text, 5)
            ]
        except OSError:
            pass

    # Counts are taken here, before any budget trimming, and are what the
    # block shows. The texts are trimmed or dropped to fit the budget.
    result["blocker_count"] = len(result["blockers"])
    result["open_question_count"] = len(result["open_questions"])
    return result


def _section_lines(content, title, exact=False):
    """Lines of the `## ` section whose heading contains `title` (or equals it
    after stripping, with exact=True). None if there is no such section."""
    lines = content.split("\n")
    for i, line in enumerate(lines):
        if not line.startswith("## "):
            continue
        # Drop a leading emoji or symbol ("## ❓ Open Questions").
        head = re.sub(r'^[^\w]+', '', line[3:].strip())
        hit = head.lower() == title.lower() if exact else title.lower() in head.lower()
        if hit:
            out = []
            for l in lines[i + 1:]:
                if l.startswith("## "):
                    break
                out.append(l)
            return out
    return None


_DATE_FORMATS = ("%Y-%m-%d", "%b %d %Y", "%B %d %Y", "%b %d, %Y", "%B %d, %Y")


def _parse_date(text):
    from datetime import datetime
    text = text.strip().strip("[]*")
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def recent_changelog_entries(text, n):
    """The newest `n` entries of a project Changelog.md, newest first.

    Understands dated H2 sections with bullets (`## 2026-11-19 (dev work)`),
    tables whose first cell is a date (`| May 18 2026 | ... |`), and
    `[2026-04-01] ...` lines. Anything else falls back to the last `n`
    non-empty lines, newest (last) first.
    """
    entries, current = [], None
    for idx, raw in enumerate(text.split("\n")):
        line = raw.strip()
        h = re.match(r'^##\s+(\d{4}-\d{2}-\d{2})', line)
        if h:
            current = _parse_date(h.group(1))
            continue
        if line.startswith("## "):
            current = None
            continue
        if line.startswith("|"):
            cells = [c.strip() for c in line.strip("|").split("|")]
            d = _parse_date(cells[0]) if cells else None
            if d and len(cells) > 1:
                entries.append((d, idx, f"{d.isoformat()}: {' — '.join(c for c in cells[1:] if c)}"))
            continue
        b = re.match(r'^\[(\d{4}-\d{2}-\d{2})\]\s*(.*)$', line)
        if b and _parse_date(b.group(1)):
            entries.append((_parse_date(b.group(1)), idx, f"{b.group(1)}: {b.group(2)}"))
            continue
        if current and re.match(r'^[-*]\s+', line):
            bullet = re.sub(r'^[-*]\s+', '', line)
            entries.append((current, idx, f"{current.isoformat()}: {bullet}"))
    if entries:
        # Newest date first; within a date keep file order.
        entries.sort(key=lambda e: (-e[0].toordinal(), e[1]))
        return [e[2] for e in entries[:n]]
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    return list(reversed(lines[-n:]))


def derive_project_name(project_entry):
    """Derive a human-readable project name from the registry entry."""
    cf = project_entry.get("context_file", "")
    # Strip " — Project Context.md" suffix if present
    if " — Project Context" in cf:
        return cf.split(" — Project Context")[0]
    # Fallback: last segment of vault_path
    vp = project_entry.get("vault_path", "")
    return vp.split("/")[-1] if "/" in vp else project_entry["id"]


# ── Token budget ────────────────────────────────────────────────────────────
# Boot context grows silently as memory.md, personality.md, and the changelog
# grow. Without a ceiling, every session pays for the full read forever.
#
# This is a coarse character-budget gate, not a real tokenizer pass — at ~4
# chars/token for English Markdown it lands within ~10% of the true count,
# and we'd rather under-fill than block boot waiting for a model. Sections
# are filled in priority order; what doesn't fit is replaced with a stub
# Claude can re-fetch on demand via the read-side MCP tools.

# Default ~2,000 tokens ≈ 8,000 characters for the whole rendered block.
# A config budget_chars of 0 still disables the gate (tests and debugging).
DEFAULT_BUDGET_CHARS = 8000

# Fixed text session-start adds around the fields (the behavior notes and
# labels). Counted against the budget so the rendered block, not just the
# JSON fields, stays under it. Keep roughly in step with hooks/lib/render-session.py.
RENDER_OVERHEAD_CHARS = 1800


def estimate_chars(value):
    """Rough char count for any field the budget tracks."""
    if value is None:
        return 0
    if isinstance(value, str):
        return len(value)
    if isinstance(value, dict):
        return len(json.dumps(value))
    if isinstance(value, list):
        return sum(estimate_chars(v) for v in value)
    return len(str(value))


def truncate_text(text, max_chars):
    """Truncate text to max_chars, adding a one-line stub explaining the cut."""
    if max_chars <= 0:
        return f"[truncated for token budget — {len(text)} chars omitted]"
    if len(text) <= max_chars:
        return text
    keep = text[:max_chars].rstrip()
    return keep + f"\n[…truncated for token budget — {len(text) - max_chars} chars omitted]"


MAX_BLOCKERS_SHOWN = 5  # render-session.py shows at most this many texts


def project_render_size(p):
    """Chars render-session.py prints for the project: what is shown, not the
    JSON (open-question texts are never shown, only their count)."""
    if not p:
        return 0
    shown = (
        [p.get("name") or "", p.get("vault_path") or "", p.get("stage") or ""]
        + list(p.get("blockers") or [])[:MAX_BLOCKERS_SHOWN]
        + list(p.get("recent_decisions") or [])[:3]
    )
    return sum(len(s) + 4 for s in shown) + 200  # labels and separators


def apply_token_budget(output, budget_chars):
    """Greedy fill in priority order; truncate or stub anything that overflows.

    Mutates `output` in place. Priority (highest first):
      1. project (L3 hub data — most situational value)
      2. personality (summary: who, layout, writing rules)
      3. memory (section index, or tail for an unsectioned file)
      4. recent_activity (last 15 changelog lines)
    active_projects is reserved and never truncated. learner_profile is not
    rendered (session-start only points at its path), so it is not counted.
    """
    if budget_chars is None or budget_chars <= 0:
        return  # disabled

    # Fixed-size fields that always count first. The bucket list
    # (active_projects) is the L1/L2 project-name anchor — small and high-value,
    # so it is RESERVED here and never truncated, instead of competing at the
    # bottom of the priority list where a large personality.md would starve it.
    fixed_overhead = (
        estimate_chars(output.get("vault_path"))
        + estimate_chars(output.get("activation_level"))
        + estimate_chars(output.get("inbox_count"))
        + estimate_chars(output.get("feature_suggestion"))
        + estimate_chars(output.get("active_projects"))
        + estimate_chars(output.get("activation_warning"))
        + RENDER_OVERHEAD_CHARS
    )

    remaining = budget_chars - fixed_overhead
    truncated_fields = []

    priority = [
        ("project", project_render_size),
        ("personality", lambda v: v or ""),
        ("memory", lambda v: v or ""),
        ("recent_activity", lambda v: v or ""),
    ]

    for key, render in priority:
        value = output.get(key)
        rendered = render(value)
        size = rendered if isinstance(rendered, int) else len(rendered)
        if size <= remaining:
            remaining -= size
            continue

        # Doesn't fit. Truncate string fields; stub structured fields.
        if isinstance(value, str):
            kept = max(remaining, 0)
            # If almost nothing would survive, drop the field entirely (None)
            # rather than emitting a content-free "[truncated …]" stub that
            # session-start would render under a misleading header.
            if kept < 40:
                output[key] = None
            else:
                output[key] = truncate_text(value, kept)
            truncated_fields.append(key)
            remaining = 0
        elif isinstance(value, dict):
            # Keep the highest-signal subset for project hub. The counts stay
            # the real ones from parse_hub.
            if key == "project":
                output[key] = {
                    "id": value.get("id"),
                    "name": value.get("name"),
                    "vault_path": value.get("vault_path"),
                    "stage": value.get("stage"),
                    "blockers": value.get("blockers", [])[:3],
                    "open_questions": [],
                    "recent_decisions": value.get("recent_decisions", [])[:1],
                    "blocker_count": value.get("blocker_count", len(value.get("blockers", []))),
                    "open_question_count": value.get(
                        "open_question_count", len(value.get("open_questions", []))),
                    "parsed": value.get("parsed"),
                    "_truncated": True,
                }
                truncated_fields.append(key)
                remaining -= project_render_size(output[key])
            else:
                remaining = 0
        else:
            output[key] = None
            truncated_fields.append(key)

    if truncated_fields:
        output["_budget"] = {
            "limit_chars": budget_chars,
            "truncated": truncated_fields,
            "hint": "Read the full content via the MCP tools (read_hub, search_vault) when needed.",
        }


def _parse_dormant_features(personality_content):
    """Extract dormant feature names from personality.md frontmatter.

    Handles BOTH declared shapes:
      - feature: "weekly_review"     (doc-rich form, progressive-features.md)
      - name: weekly_review          (compact form, used by onboarding/tests)
    Returns an ordered list of feature-name strings (deduped, order preserved).
    """
    fm_match = re.search(r'^---\s*\n(.*?)\n---', personality_content, re.DOTALL)
    if not fm_match:
        return []
    fm = fm_match.group(1)
    # Capture the dormant: block — list items until the next same-or-lower
    # indented key. Lines belonging to the block are more-indented than
    # "dormant:" (which itself sits under progressive_features).
    dormant_match = re.search(r'\n(\s*)dormant:\s*\n((?:\1\s+.*\n?)*)', fm)
    if not dormant_match:
        return []
    block = dormant_match.group(2)
    names = []
    for m in re.finditer(r'-\s*(?:feature|name)\s*:\s*"?([A-Za-z0-9_]+)"?', block):
        nm = m.group(1)
        if nm and nm not in names:
            names.append(nm)
    return names


def _dormant_state_path(vault_path):
    return os.path.join(vault_path, ".claude", "cortex", "dormant-suggested.json")


def _read_dormant_state(vault_path):
    """Read per-feature last_suggested map. Returns dict {feature: 'YYYY-MM-DD'}."""
    path = _dormant_state_path(vault_path)
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, UnicodeDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def _write_dormant_state(vault_path, state):
    """Persist per-feature last_suggested map. Best-effort, atomic-ish."""
    path = _dormant_state_path(vault_path)
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        tmp = path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(state, f)
        os.replace(tmp, path)
    except OSError:
        pass


def check_dormant_features(personality_content, changelog_total, vault_path=None,
                           today=None, suppress_days=7):
    """Suggest the next dormant feature ready to activate, with 7-day suppression.

    W3.3 (T21): generalized from the old single hardcoded `weekly_review` check.
    Iterates ALL dormant features declared in personality.md (in declared order,
    the doc's first-ready / priority proxy). The activation signal is still the
    coarse changelog-volume gate (>=50 entries) the boot path can evaluate
    cheaply; richer per-feature signals belong in the MCP `check_dormant_features`
    tool. To avoid re-suggesting the same feature every session, each suggestion
    writes a per-feature `last_suggested` date to
    `<vault>/.claude/cortex/dormant-suggested.json` and is suppressed for
    `suppress_days` (~7) days. Returns a suggestion string or None.
    """
    if changelog_total < 50:
        return None
    features = _parse_dormant_features(personality_content)
    if not features:
        return None

    if today is None:
        from datetime import date
        today = date.today()
    else:
        from datetime import date
        if isinstance(today, str):
            today = date.fromisoformat(today)

    from datetime import date as _date

    state = _read_dormant_state(vault_path) if vault_path else {}

    for feat in features:
        last = state.get(feat)
        if last:
            try:
                last_d = _date.fromisoformat(str(last))
                if (today - last_d).days < suppress_days:
                    continue  # still in cooldown — skip
            except ValueError:
                pass  # malformed date → treat as never suggested
        # This feature is eligible. Record the suggestion and return it.
        if vault_path:
            state[feat] = today.isoformat()
            _write_dormant_state(vault_path, state)
        return (
            f"{feat} may be ready to activate (changelog has {changelog_total}+ "
            f"entries). Want me to turn it on?"
        )
    return None


def main():
    parser = argparse.ArgumentParser(description="Cortex boot context loader")
    parser.add_argument("--config", default=os.path.expanduser("~/.claude/cortex/config.json"))
    parser.add_argument("--cwd", default=os.getcwd())
    parser.add_argument("--memory-cap", type=int, default=100)
    parser.add_argument(
        "--budget-chars",
        type=int,
        default=None,
        help=(
            "Soft ceiling on session-block size in characters (~4 chars/token). "
            "Sections are filled in priority order and overflow is truncated. "
            "Pass 0 to disable. Overrides the optional budget_chars config key; "
            "if neither is set, defaults to ~8000."
        ),
    )
    args = parser.parse_args()

    # Config, vault and personality.md (required). See check_setup for how
    # "not set up" (3) differs from "unreadable" (4).
    vault_path, personality, failure = check_setup(args.config)
    if failure:
        code, reason = failure
        json.dump({"error": "not_set_up" if code == NOT_SET_UP else "unreadable",
                   "vault_path": vault_path, "reason": reason}, sys.stdout)
        sys.exit(code)

    # Read optional files
    memory = summarize_memory(vault_path, args.memory_cap)
    learner_profile = read_learner_profile(vault_path)
    recent_activity, changelog_total = read_changelog(vault_path)
    inbox_count = count_inbox(vault_path)

    # Resolve cwd to activation level
    registry = read_registry(vault_path)
    default_project = read_config_default_project(args.config)
    activation_level, project_entry = resolve_cwd(
        vault_path, args.cwd, registry, default_project=default_project
    )

    # Self-diagnosis: if we landed at L1 but a Cortex stub/vault sits nearby,
    # surface a one-line warning so the user can register the repo.
    activation_warning = None
    if activation_level == 1:
        activation_warning = detect_nearby_cortex(args.cwd)

    # Parse hub for L3 sessions
    project = None
    if activation_level == 3 and project_entry:
        hub_data = parse_hub(vault_path, project_entry)
        project = {
            "id": project_entry["id"],
            "name": derive_project_name(project_entry),
            "vault_path": project_entry["vault_path"],
            **(hub_data or {"stage": None, "blockers": [], "open_questions": [],
                            "recent_decisions": [], "hub_missing": True}),
        }
    elif activation_level == 2 and project_entry:
        # L2 via default_project: surface the anchor's identity without the full
        # L3 hub parse (keeps L2 cheap and preserves the L3 read contract).
        project = {
            "id": project_entry["id"],
            "name": derive_project_name(project_entry),
            "vault_path": project_entry["vault_path"],
            "default": True,
        }

    # Check dormant features (W3.3: generalized + 7-day per-feature suppression).
    feature_suggestion = check_dormant_features(
        personality, changelog_total, vault_path=vault_path
    )

    # Extract bucket list for L1/L2 (W3.5: also surface registered project NAMES,
    # not just bucket names, so an L1/L2 session has concrete project anchors).
    active_projects = None
    if activation_level < 3:
        buckets = extract_buckets(personality)
        project_names = [
            derive_project_name(p) for p in registry.get("projects", [])
        ]
        project_names = [n for n in project_names if n]
        parts = []
        if buckets:
            parts.append(f"Buckets: {buckets}")
        if project_names:
            # Cap so a large registry can't blow the boot budget.
            shown = project_names[:12]
            more = len(project_names) - len(shown)
            names_str = ", ".join(shown)
            if more > 0:
                names_str += f", +{more} more"
            parts.append(f"Projects: {names_str}")
        active_projects = " | ".join(parts) if parts else (buckets or None)

    # personality and memory are summaries (see summarize_*). The MCP
    # get_boot_context tool still returns the full files.
    output = {
        "vault_path": vault_path,
        "activation_level": activation_level,
        "personality": summarize_personality(personality),
        "memory": memory,
        "learner_profile": learner_profile,
        "recent_activity": recent_activity,
        "inbox_count": inbox_count,
        "active_projects": active_projects,
        "project": project,
        "feature_suggestion": feature_suggestion,
        "activation_warning": activation_warning,
    }

    # Resolve budget: CLI flag wins; else config budget_chars; else default.
    budget_chars = args.budget_chars
    if budget_chars is None:
        budget_chars = read_config_budget(args.config)
    if budget_chars is None:
        budget_chars = DEFAULT_BUDGET_CHARS

    # Apply token budget last so it acts on final assembled state.
    apply_token_budget(output, budget_chars)
    # render-session.py hard-caps the final hook output at this size.
    output["budget_chars"] = budget_chars

    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()

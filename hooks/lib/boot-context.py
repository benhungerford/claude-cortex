#!/usr/bin/env python3
"""Boot context loader for Claude Cortex session-start hook.

Reads vault files, resolves cwd to a project, computes activation level,
and outputs structured JSON to stdout. Called by hooks/session-start.

Exit codes:
  0 — success, JSON on stdout
  1 — no config, no vault, or no personality (onboarding needed)
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
                        "L1 computed, but a Cortex stub CLAUDE.md was found nearby "
                        "— this repo may not be registered. Run /cortex-register-repo "
                        "to link it for L3 context."
                    )
            except (OSError, UnicodeDecodeError):
                pass
        if os.path.isdir(os.path.join(candidate, ".claude", "cortex")):
            return (
                "L1 computed, but a Cortex vault marker was found nearby. "
                "Run /cortex-register-repo to link this repo for full context."
            )
        parent = os.path.dirname(candidate)
        if candidate == home or parent == candidate:
            break
        candidate = parent
        depth += 1
    return None


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
        with open(hub_path, encoding="utf-8") as f:
            content = f.read()
    except (OSError, UnicodeDecodeError):
        return None

    result = {
        "stage": None,
        "blockers": [],
        "open_questions": [],
        "recent_decisions": [],
    }

    # Parse Stage Tracker table
    stage_section = re.search(
        r'## Stage Tracker\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)',
        content,
    )
    if stage_section:
        rows = stage_section.group(1).strip().split("\n")
        # First pass: look for "In Progress" or "Current"
        for row in rows:
            cells = [c.strip() for c in row.split("|")[1:-1]]
            if len(cells) >= 2 and cells[1] in ("In Progress", "Current"):
                result["stage"] = cells[0]
                break
        # Fallback: last row with non-empty, non-"Not Started" status
        if not result["stage"]:
            for row in reversed(rows):
                cells = [c.strip() for c in row.split("|")[1:-1]]
                if len(cells) >= 2 and cells[1] and cells[1] != "Not Started":
                    result["stage"] = cells[0]
                    break

    # Parse Open Questions & Blockers table
    oq_section = re.search(
        r'## Open Questions & Blockers\s*\n\|[^\n]*\n\|[-| ]+\n((?:\|[^\n]*\n)*)',
        content,
    )
    if oq_section:
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
                result["blockers"].append(question)
            else:
                result["open_questions"].append(question)

    # Recent decisions from project Changelog.md
    changelog_path = os.path.join(
        vault_path, project_entry["vault_path"], "Changelog.md"
    )
    if os.path.isfile(changelog_path):
        try:
            with open(changelog_path, encoding="utf-8") as f:
                lines = [l.strip() for l in f.readlines() if l.strip()]
            result["recent_decisions"] = lines[-5:]
        except (OSError, UnicodeDecodeError):
            pass

    return result


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

# Default ~2,000 tokens ≈ 8,000 characters. Skill content + tool defs
# already consume ~10k tokens; this keeps boot under ~12k total before the
# user's first message.
DEFAULT_BUDGET_CHARS = 8000


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


def apply_token_budget(output, budget_chars):
    """Greedy fill in priority order; truncate or stub anything that overflows.

    Mutates `output` in place. Priority (highest first):
      1. project (L3 hub data — most situational value)
      2. personality (identity + sub-note types — drives skill behavior)
      3. recent_activity (last 15 changelog lines)
      4. memory (long-term facts)
      5. learner_profile (coaching context, optional)
      6. active_projects (L1/L2 bucket list, only when no project)
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
        + 200  # JSON keys + delimiters
    )

    remaining = budget_chars - fixed_overhead
    truncated_fields = []

    priority = [
        ("project", lambda v: json.dumps(v) if v else ""),
        ("personality", lambda v: v or ""),
        ("recent_activity", lambda v: v or ""),
        ("memory", lambda v: v or ""),
        ("learner_profile", lambda v: v or ""),
    ]

    for key, render in priority:
        value = output.get(key)
        rendered = render(value)
        size = len(rendered) if isinstance(rendered, str) else estimate_chars(rendered)
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
            # Keep the highest-signal subset for project hub.
            if key == "project":
                output[key] = {
                    "id": value.get("id"),
                    "name": value.get("name"),
                    "vault_path": value.get("vault_path"),
                    "stage": value.get("stage"),
                    "blockers": value.get("blockers", [])[:3],
                    "open_questions": value.get("open_questions", [])[:3],
                    "recent_decisions": value.get("recent_decisions", [])[:3],
                    "_truncated": True,
                }
                truncated_fields.append(key)
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


def check_dormant_features(personality_content, changelog_total):
    """Check if any dormant features should be suggested. Returns string or None."""
    if changelog_total < 50:
        return None
    fm_match = re.search(r'^---\s*\n(.*?)\n---', personality_content, re.DOTALL)
    if not fm_match:
        return None
    fm = fm_match.group(1)
    dormant_match = re.search(r'dormant:\s*\n((?:\s+- .*\n)*)', fm)
    if dormant_match and "weekly_review" in dormant_match.group(1):
        return f"weekly_review may be ready to activate (changelog has {changelog_total}+ entries)"
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

    # Read config
    vault_path = read_config(args.config)
    if not vault_path:
        sys.exit(1)

    # Read personality (required)
    personality = read_personality(vault_path)
    if not personality:
        sys.exit(1)

    # Read optional files
    memory = read_memory(vault_path, args.memory_cap)
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
            **(hub_data or {"stage": None, "blockers": [], "open_questions": [], "recent_decisions": []}),
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

    # Check dormant features
    feature_suggestion = check_dormant_features(personality, changelog_total)

    # Extract bucket list for L1/L2
    active_projects = extract_buckets(personality) if activation_level < 3 else None

    output = {
        "vault_path": vault_path,
        "activation_level": activation_level,
        "personality": personality,
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

    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()

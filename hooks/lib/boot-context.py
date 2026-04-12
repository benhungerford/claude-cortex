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
import sys


def read_config(config_path):
    """Read vault_path from config.json. Returns path string or None."""
    try:
        with open(config_path) as f:
            config = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    vault_path = config.get("vault_path", "")
    if not vault_path or not os.path.isdir(vault_path):
        return None
    return vault_path



def read_personality(vault_path):
    """Read personality.md. Returns content string or None if missing."""
    path = os.path.join(vault_path, "personality.md")
    if not os.path.isfile(path):
        return None
    with open(path) as f:
        return f.read()


def read_memory(vault_path, cap=100):
    """Read memory.md, tail-capped at cap lines. Returns string."""
    path = os.path.join(vault_path, "memory.md")
    if not os.path.isfile(path):
        return ""
    with open(path) as f:
        lines = f.readlines()
    if len(lines) > cap:
        lines = lines[-cap:]
    return "".join(lines)


def read_learner_profile(vault_path):
    """Read Knowledge Base/Growth/_profile.md. Returns content string or empty."""
    path = os.path.join(vault_path, "Knowledge Base", "Growth", "_profile.md")
    if not os.path.isfile(path):
        return ""
    with open(path) as f:
        return f.read()


def read_changelog(vault_path, tail=15):
    """Read last N lines of _changelog.txt. Returns (content, total_lines)."""
    path = os.path.join(vault_path, "_changelog.txt")
    if not os.path.isfile(path):
        return "", 0
    with open(path) as f:
        all_lines = f.readlines()
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
        with open(path) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"schema_version": 1, "projects": []}


def resolve_cwd(vault_path, cwd, registry):
    """Resolve cwd to an activation level and optional project entry.

    Returns (level: int, project_entry: dict | None).
    Level 3 = cwd matches a registered repo.
    Level 2 = cwd is inside the vault.
    Level 1 = neither.
    """
    cwd_real = os.path.realpath(cwd)
    vault_real = os.path.realpath(vault_path)
    is_inside_vault = (
        cwd_real == vault_real or cwd_real.startswith(vault_real + os.sep)
    )

    # Walk up from cwd, check each candidate against registry repo_paths
    home = os.path.expanduser("~")
    candidate = cwd_real
    projects = registry.get("projects", [])

    while candidate and candidate != os.path.dirname(candidate):
        for project in projects:
            for repo_path in project.get("repo_paths", []):
                if os.path.realpath(repo_path) == candidate:
                    return 3, project
        parent = os.path.dirname(candidate)
        # Stop at home directory or root
        if candidate == home or parent == candidate:
            break
        candidate = parent

    if is_inside_vault:
        return 2, None

    return 1, None


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

    with open(hub_path) as f:
        content = f.read()

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
        with open(changelog_path) as f:
            lines = [l.strip() for l in f.readlines() if l.strip()]
        result["recent_decisions"] = lines[-5:]

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
    activation_level, project_entry = resolve_cwd(vault_path, args.cwd, registry)

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
    }
    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()

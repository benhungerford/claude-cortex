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
    recent_activity, changelog_total = read_changelog(vault_path)
    inbox_count = count_inbox(vault_path)

    # Placeholder for cwd resolution (Task 2)
    activation_level = 1
    project = None

    # Placeholder for dormant features (Task 3)
    feature_suggestion = None

    # Extract bucket list for L1/L2
    active_projects = extract_buckets(personality) if activation_level < 3 else None

    output = {
        "vault_path": vault_path,
        "activation_level": activation_level,
        "personality": personality,
        "memory": memory,
        "recent_activity": recent_activity,
        "inbox_count": inbox_count,
        "active_projects": active_projects,
        "project": project,
        "feature_suggestion": feature_suggestion,
    }
    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()

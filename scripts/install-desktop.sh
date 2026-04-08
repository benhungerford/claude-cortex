#!/usr/bin/env bash
# Claude Cortex — Claude Desktop / Cowork install helper
# Copies the cortex skill into the Desktop skills directory.
#
# NOTE: Claude Desktop does not currently support the Claude Code plugin/hook system.
# This script installs only the skill portion; Desktop users get the skill but not
# the hook-based features (auto-logging, deterministic trigger detection, etc.).
# Those will land as skill-based fallbacks in Stage 2 of the plugin roadmap.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_SRC="$PLUGIN_ROOT/skills/cortex"

echo "Claude Cortex — Desktop install helper"
echo "Plugin root: $PLUGIN_ROOT"
echo

if [ ! -d "$SKILL_SRC" ]; then
  echo "ERROR: skill source missing at $SKILL_SRC" >&2
  exit 1
fi

# Detect platform and set Desktop skills path
case "$(uname -s)" in
  Darwin)
    DESKTOP_SUPPORT="$HOME/Library/Application Support/Claude"
    ;;
  Linux)
    DESKTOP_SUPPORT="$HOME/.config/Claude"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    DESKTOP_SUPPORT="$APPDATA/Claude"
    ;;
  *)
    echo "ERROR: unsupported platform $(uname -s)" >&2
    exit 1
    ;;
esac

if [ ! -d "$DESKTOP_SUPPORT" ]; then
  echo "WARNING: Claude Desktop application support dir not found at:"
  echo "  $DESKTOP_SUPPORT"
  echo "Is Claude Desktop installed?"
  echo
  echo "If you know the correct path, set CLAUDE_DESKTOP_SKILLS_DIR and re-run:"
  echo "  CLAUDE_DESKTOP_SKILLS_DIR=/path/to/skills bash $0"
  if [ -z "${CLAUDE_DESKTOP_SKILLS_DIR:-}" ]; then
    exit 1
  fi
fi

SKILLS_DIR="${CLAUDE_DESKTOP_SKILLS_DIR:-$DESKTOP_SUPPORT/skills}"
DEST="$SKILLS_DIR/cortex"

echo "Target skill dir: $DEST"
echo

if [ -e "$DEST" ]; then
  BACKUP="$DEST.backup-$(date +%Y%m%d-%H%M%S)"
  echo "Existing skill found — backing up to: $BACKUP"
  mv "$DEST" "$BACKUP"
fi

mkdir -p "$SKILLS_DIR"
cp -R "$SKILL_SRC" "$DEST"

echo "Skill copied successfully."
echo
echo "Next steps:"
echo "  1. Restart Claude Desktop"
echo "  2. Open a new Cowork session"
echo "  3. The Cortex skill should appear in the loaded skills list"
echo
echo "To uninstall later: rm -rf \"$DEST\""
echo

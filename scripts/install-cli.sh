#!/usr/bin/env bash
# Claude Cortex — Claude Code install helper
# Verifies the plugin manifest, then prints the /plugin commands to run inside a Claude Code session.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_JSON="$PLUGIN_ROOT/.claude-plugin/plugin.json"
MARKETPLACE_JSON="$PLUGIN_ROOT/.claude-plugin/marketplace.json"

echo "Claude Cortex — CLI install helper"
echo "Plugin root: $PLUGIN_ROOT"
echo

# Verify manifests exist and parse cleanly
for f in "$PLUGIN_JSON" "$MARKETPLACE_JSON"; do
  if [ ! -f "$f" ]; then
    echo "ERROR: missing $f" >&2
    exit 1
  fi
  if command -v python3 >/dev/null 2>&1; then
    python3 -c "import json; json.load(open('$f'))" || {
      echo "ERROR: $f is not valid JSON" >&2
      exit 1
    }
  fi
done

# Install MCP server dependencies
if [ -f "$PLUGIN_ROOT/mcp-servers/cortex-vault/package.json" ]; then
  echo "Installing MCP server dependencies..."
  (cd "$PLUGIN_ROOT/mcp-servers/cortex-vault" && npm install --production --silent)
  echo "MCP server: cortex-vault"
  echo
fi

# Verify Claude Code is installed
if [ ! -d "$HOME/.claude" ]; then
  echo "WARNING: ~/.claude does not exist. Is Claude Code installed?" >&2
fi

PLUGIN_NAME=$(python3 -c "import json; print(json.load(open('$PLUGIN_JSON'))['name'])" 2>/dev/null || echo "claude-cortex")
PLUGIN_VERSION=$(python3 -c "import json; print(json.load(open('$PLUGIN_JSON'))['version'])" 2>/dev/null || echo "0.1.0")
MARKETPLACE_NAME=$(python3 -c "import json; print(json.load(open('$MARKETPLACE_JSON'))['name'])" 2>/dev/null || echo "claude-cortex-local")

echo "Manifest validated."
echo "  Plugin:      $PLUGIN_NAME v$PLUGIN_VERSION"
echo "  Marketplace: $MARKETPLACE_NAME"
echo
echo "To install, run these commands inside a Claude Code session:"
echo
echo "  /plugin marketplace add $PLUGIN_ROOT"
echo "  /plugin install $PLUGIN_NAME@$MARKETPLACE_NAME"
echo
echo "Then restart Claude Code (or start a new session) to activate the plugin."
echo
echo "Alternatively, for development without installing:"
echo
echo "  claude --plugin-dir $PLUGIN_ROOT"
echo

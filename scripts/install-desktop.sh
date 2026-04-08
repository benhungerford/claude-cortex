#!/usr/bin/env bash
# Claude Cortex — Claude Desktop / Cowork install helper
#
# IMPORTANT: Cowork (Claude Desktop's agentic mode) runs Claude Code inside a VM
# at ~/Library/Application Support/Claude/local-agent-mode-sessions/. That VM
# inherits your user-level ~/.claude/skills/ and ~/.claude/plugins/ automatically.
#
# This means there is NO separate Desktop install path. The same plugin install
# that works in Claude Code also works in Cowork — you only need to install once.
#
# This script is a thin wrapper that delegates to install-cli.sh and prints a
# Cowork-specific note about restarting.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Claude Cortex — Desktop / Cowork install helper"
echo
echo "Cowork runs Claude Code in a VM and inherits your user-level plugins."
echo "Installing the plugin once via Claude Code makes it available in both"
echo "Claude Code AND Cowork sessions."
echo
echo "Delegating to install-cli.sh..."
echo "---"
bash "$PLUGIN_ROOT/scripts/install-cli.sh"
echo "---"
echo
echo "After running the /plugin commands above in a Claude Code session:"
echo "  1. Quit Claude Desktop completely (Cmd+Q, not just close window)"
echo "  2. Reopen Claude Desktop"
echo "  3. Start a new Cowork conversation"
echo "  4. The Cortex skill should appear in the loaded skills list"
echo
echo "Note: Cowork's remote agent mode (when it runs on Anthropic's infra)"
echo "cannot see your local plugin folder. To use Cortex in remote Cowork"
echo "sessions, the plugin will need to be published to a public marketplace —"
echo "tracked as part of Stage 4 of the plugin migration plan."
echo

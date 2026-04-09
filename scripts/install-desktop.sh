#!/usr/bin/env bash
# Claude Cortex — Claude Desktop install helper
#
# Claude Desktop has THREE plugin surfaces:
#   1. Code sidebar       — uses ~/.claude/plugins/ (same as Claude Code CLI)
#   2. Cowork             — uses per-workspace ~/Library/Application Support/Claude/
#                           local-agent-mode-sessions/<session>/<workspace>/cowork_plugins/
#   3. Regular Desktop Chat — uses DXT extensions (NOT yet supported; separate build target)
#
# This script handles (1) by delegating to install-cli.sh, then handles (2) by
# mirroring the install into every Cowork workspace it finds.

set -euo pipefail

PLUGIN_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SESSIONS_ROOT="$HOME/Library/Application Support/Claude/local-agent-mode-sessions"

echo "Claude Cortex — Desktop install helper"
echo "Plugin root: $PLUGIN_ROOT"
echo

echo "Step 1/2: Installing into ~/.claude/plugins/ (Claude Code + Desktop Code sidebar)"
echo "---"
bash "$PLUGIN_ROOT/scripts/install-cli.sh"
echo "---"
echo

echo "Step 2/2: Mirroring install into Cowork plugin stores"
if [ ! -d "$SESSIONS_ROOT" ]; then
  echo "  No Cowork sessions directory found at: $SESSIONS_ROOT"
  echo "  Skipping Cowork install. Open Cowork at least once, then re-run."
  exit 0
fi

# Find every cowork_plugins directory (bash 3.2 compatible — macOS default)
COWORK_STORES=()
while IFS= read -r line; do
  COWORK_STORES+=("$line")
done < <(find "$SESSIONS_ROOT" -type d -name "cowork_plugins" 2>/dev/null)

if [ ${#COWORK_STORES[@]} -eq 0 ]; then
  echo "  No cowork_plugins/ stores found. Open a Cowork session at least once, then re-run."
  exit 0
fi

echo "  Found ${#COWORK_STORES[@]} Cowork plugin store(s):"
for s in "${COWORK_STORES[@]}"; do echo "    $s"; done
echo

PYTHON=${PYTHON:-python3}
for CP in "${COWORK_STORES[@]}"; do
  echo "  Installing into: $CP"
  PLUGIN_ROOT="$PLUGIN_ROOT" CP="$CP" "$PYTHON" - <<'PY'
import json, os, shutil, hashlib, datetime, subprocess
CP = os.environ["CP"]
SRC = os.environ["PLUGIN_ROOT"]
MP, PN, VER = "claude-cortex-local", "claude-cortex", "1.0.0"
PID = f"{PN}@{MP}"
now = datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S.000Z")

for sub in ("cache", "marketplaces", ".install-manifests"):
    os.makedirs(f"{CP}/{sub}", exist_ok=True)

km_path = f"{CP}/known_marketplaces.json"
km = json.load(open(km_path)) if os.path.exists(km_path) else {}
km[MP] = {"source": {"source": "directory", "path": SRC}, "installLocation": SRC, "lastUpdated": now}
json.dump(km, open(km_path, "w"), indent=2)

dst = f"{CP}/cache/{MP}/{PN}/{VER}"
if os.path.exists(dst): shutil.rmtree(dst)
shutil.copytree(SRC, dst, ignore=lambda d, names: [n for n in names if n in (".git",)])

ip_path = f"{CP}/installed_plugins.json"
ip = json.load(open(ip_path)) if os.path.exists(ip_path) else {"version": 2, "plugins": {}}
ip.setdefault("plugins", {})
try:
    gitsha = subprocess.check_output(["git", "-C", SRC, "rev-parse", "HEAD"]).decode().strip()
except Exception:
    gitsha = ""
ip["plugins"][PID] = [{
    "scope": "user", "installPath": dst, "version": VER,
    "installedAt": now, "lastUpdated": now, "gitCommitSha": gitsha,
}]
json.dump(ip, open(ip_path, "w"), indent=2)

files = {}
for root, dirs, fs in os.walk(dst):
    if ".git" in dirs: dirs.remove(".git")
    for f in fs:
        full = os.path.join(root, f)
        rel = os.path.relpath(full, dst)
        files[rel] = hashlib.sha256(open(full, "rb").read()).hexdigest()
json.dump({"pluginId": PID, "createdAt": now, "files": files},
          open(f"{CP}/.install-manifests/{PID}.json", "w"), indent=2)
print(f"    OK — {len(files)} files, git {gitsha[:8] if gitsha else '(none)'}")
PY
done

echo
echo "Done. To activate in Cowork:"
echo "  1. Quit Claude Desktop completely (Cmd+Q)"
echo "  2. Reopen Claude Desktop"
echo "  3. Start a new Cowork session"
echo "  4. Verify 'claude-cortex:cortex-boot' appears in the loaded skills"
echo
echo "NOTE: If Cowork creates a new workspace later, re-run this script to"
echo "mirror the install into it. Remote Cowork (Anthropic-hosted) requires"
echo "a published marketplace — tracked as Stage 4."
echo

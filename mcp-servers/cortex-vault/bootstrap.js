#!/usr/bin/env node
'use strict';

// cortex-vault bootstrap
// ────────────────────────────────────────────────────────────────────────────
// Entry point for the MCP server. Invoked by Claude Code via .mcp.json.
//
// Purpose: survive plugin cache refreshes and no-terminal installs. Claude Code
// periodically re-extracts the plugin sources from the marketplace repo, which
// wipes this directory's node_modules/ (node_modules is git-ignored, so it is
// never shipped in a marketplace install). Calling server.js directly in that
// state throws MODULE_NOT_FOUND and the MCP client silently fails to connect —
// leaving the plugin's slash commands, boot fallback, and ambient recall
// useless. In Cowork (no terminal) the user cannot run `npm install` by hand,
// so the MCP server would be permanently dead.
//
// This wrapper runs a fast integrity check on node_modules/. On every launch
// where deps are already present (the normal case) the check is a few
// fs.existsSync calls — effectively free.
//
// DEFAULT: auto-install missing deps on launch so the MCP server is reliably
// available everywhere, including no-terminal Cowork sessions. The install is
// ANNOUNCED on stderr (never silent). It pulls only public npm packages and
// sends NO vault data anywhere — the runtime "no vault data leaves your machine"
// promise (offline embedding, env.allowRemoteModels = false) is unchanged.
//
// OPT OUT: strict-offline users who never want an outbound network call can set
// CORTEX_SKIP_NPM_INSTALL=1 — the wrapper then fails fast with manual install
// instructions instead of reaching the network. (CORTEX_ALLOW_NPM_INSTALL is
// still honored as a legacy force-on, but install is now the default.)

const { spawnSync } = require('node:child_process');
const { needsInstall } = require('./lib/bootstrap-check.js');

const HERE = __dirname;

function log(msg) {
  process.stderr.write(`[cortex-vault] ${msg}\n`);
}

function installDisabled() {
  const v = process.env.CORTEX_SKIP_NPM_INSTALL || process.env.CORTEX_NO_NPM_INSTALL;
  return v === '1' || v === 'true' || v === 'yes';
}

function install() {
  log('Installing MCP server dependencies (first run can take 30–60s; public npm packages only, no vault data sent)…');
  const result = spawnSync(
    'npm',
    ['install', '--silent', '--no-audit', '--no-fund'],
    {
      cwd: HERE,
      stdio: ['ignore', 'inherit', 'inherit']
    }
  );
  if (result.status !== 0) {
    log('npm install failed — cortex-vault MCP tools will not be available.');
    log('Run manually: cd ' + HERE + ' && npm install');
    process.exit(result.status || 1);
  }
  log('Dependencies installed. Starting server…');
}

function failMissingDeps() {
  log('MCP server dependencies are not installed — cortex-vault tools are unavailable.');
  log('Auto-install is disabled (CORTEX_SKIP_NPM_INSTALL is set).');
  log('To install once, run:  cd ' + HERE + ' && npm install');
  log('(Or unset CORTEX_SKIP_NPM_INSTALL to let this wrapper install on launch.)');
  process.exit(1);
}

if (needsInstall(HERE)) {
  if (installDisabled()) {
    failMissingDeps();
  } else {
    install();
  }
}

// Hand off to the real server in-process. Because MCP uses stdio transport,
// the client is already connected to our stdin/stdout — require()'ing server.js
// attaches the MCP server to the same streams with no proxy layer.
require('./server.js');

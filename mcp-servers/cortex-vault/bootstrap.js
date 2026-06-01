#!/usr/bin/env node
'use strict';

// cortex-vault bootstrap
// ────────────────────────────────────────────────────────────────────────────
// Entry point for the MCP server. Invoked by Claude Code via .mcp.json.
//
// Purpose: survive plugin cache refreshes. Claude Code periodically re-extracts
// the plugin sources from the marketplace repo, which wipes this directory's
// node_modules/. Calling server.js directly in that state throws MODULE_NOT_FOUND
// and the MCP client silently fails to connect — leaving the plugin's slash
// commands and ambient recall useless until the user manually runs npm install.
//
// This wrapper runs a fast integrity check on node_modules/. On every launch
// where deps are already present (the normal case) the check is a few
// fs.existsSync calls — effectively free.
//
// W2.8 — consent for network installs. A user session must never silently make
// outbound network calls. Running `npm install` automatically here pulls code
// from the npm registry without the user's knowledge, contradicting Cortex's
// offline/"no data leaves your machine" promise. So we do NOT auto-install by
// default: if deps are missing we fail fast with a clear, actionable message.
// The install is only performed when the user has explicitly opted in via
// CORTEX_ALLOW_NPM_INSTALL=1 (e.g. a documented first-run/setup step).

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { needsInstall } = require('./lib/bootstrap-check.js');

const HERE = __dirname;

function log(msg) {
  process.stderr.write(`[cortex-vault] ${msg}\n`);
}

function consentGranted() {
  const v = process.env.CORTEX_ALLOW_NPM_INSTALL;
  return v === '1' || v === 'true' || v === 'yes';
}

function install() {
  log('Installing MCP server dependencies (first run can take 30–60s)…');
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
  log('Cortex will not run a network install during a session without your consent.');
  log('To install once, run:  cd ' + HERE + ' && npm install');
  log('(Or set CORTEX_ALLOW_NPM_INSTALL=1 to allow this wrapper to install on launch.)');
  process.exit(1);
}

if (needsInstall(HERE)) {
  if (consentGranted()) {
    install();
  } else {
    failMissingDeps();
  }
}

// Hand off to the real server in-process. Because MCP uses stdio transport,
// the client is already connected to our stdin/stdout — require()'ing server.js
// attaches the MCP server to the same streams with no proxy layer.
require('./server.js');

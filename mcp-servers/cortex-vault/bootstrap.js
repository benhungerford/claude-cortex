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
// This wrapper runs a fast integrity check on node_modules/ and, if anything is
// missing, runs npm install synchronously before loading server.js. On every
// subsequent launch (when deps are present) the check is a few fs.existsSync
// calls — effectively free.

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { needsInstall } = require('./lib/bootstrap-check.js');

const HERE = __dirname;

function log(msg) {
  process.stderr.write(`[cortex-vault] ${msg}\n`);
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

if (needsInstall(HERE)) {
  install();
}

// Hand off to the real server in-process. Because MCP uses stdio transport,
// the client is already connected to our stdin/stdout — require()'ing server.js
// attaches the MCP server to the same streams with no proxy layer.
require('./server.js');

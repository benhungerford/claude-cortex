'use strict';

// Pure integrity check used by bootstrap.js. Extracted so it can be tested
// without triggering side effects (npm install, loading the MCP server).

const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_DEPS = [
  '@modelcontextprotocol/sdk',
  '@huggingface/transformers',
  'better-sqlite3',
  'sqlite-vec',
  'js-yaml'
];

function depPresent(nodeModulesDir, name) {
  return fs.existsSync(path.join(nodeModulesDir, ...name.split('/')));
}

function needsInstall(serverDir) {
  const nodeModules = path.join(serverDir, 'node_modules');
  if (!fs.existsSync(nodeModules)) return true;
  return REQUIRED_DEPS.some((d) => !depPresent(nodeModules, d));
}

module.exports = { needsInstall, REQUIRED_DEPS };

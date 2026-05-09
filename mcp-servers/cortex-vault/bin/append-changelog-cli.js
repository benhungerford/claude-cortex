#!/usr/bin/env node
'use strict';

// Tiny CLI wrapper around lib/changelog-format.js.
//
// Used by hook scripts (post-tool-use) so the shell side never has to know
// the changelog line format — eliminating a drift risk between hook output
// and the MCP append_changelog tool.
//
// Usage:
//   append-changelog-cli.js <vaultPath> <action> <file> <dest> <note> [--automated]
//
// Always exits 0 so hook scripts never block on logging failures.

const fs = require('node:fs');
const path = require('node:path');

function main() {
  const args = process.argv.slice(2);
  const automated = args.includes('--automated');
  const positional = args.filter((a) => a !== '--automated');

  if (positional.length < 5) {
    process.stderr.write(
      'usage: append-changelog-cli.js <vaultPath> <action> <file> <dest> <note> [--automated]\n'
    );
    return;
  }

  const [vaultPath, action, file, dest, note] = positional;

  if (!fs.existsSync(vaultPath) || !fs.statSync(vaultPath).isDirectory()) {
    process.stderr.write(`vault not found: ${vaultPath}\n`);
    return;
  }

  try {
    const { formatChangelogEntry } = require('../lib/changelog-format.js');
    const entry = formatChangelogEntry({ action, file, dest, note, automated });
    fs.appendFileSync(path.join(vaultPath, '_changelog.txt'), entry + '\n', 'utf8');
  } catch (err) {
    process.stderr.write(`append-changelog-cli failed: ${err.message}\n`);
  }
}

main();
process.exit(0);

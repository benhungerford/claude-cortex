#!/usr/bin/env node
'use strict';

// Re-index a single note into the semantic search DB.
// Usage: reindex-one.js <vaultPath> <relPath>
// Designed to be called from the post-tool-use hook. Fails silently
// (always exits 0) so it never blocks a save.

const path = require('node:path');
const fs = require('node:fs');

async function main() {
  const [, , vaultPath, relPath] = process.argv;
  if (!vaultPath || !relPath) {
    process.stderr.write('usage: reindex-one.js <vaultPath> <relPath>\n');
    return;
  }
  if (!fs.existsSync(vaultPath)) {
    process.stderr.write(`vault not found: ${vaultPath}\n`);
    return;
  }

  try {
    const { indexOne } = require('../lib/indexer.js');
    const res = await indexOne(vaultPath, relPath);
    process.stdout.write(JSON.stringify(res) + '\n');
  } catch (err) {
    process.stderr.write(`reindex-one failed: ${err.message}\n`);
    try {
      const { formatChangelogEntry } = require('../lib/changelog-format.js');
      const logLine = formatChangelogEntry({
        action: 'INDEX_FAILED',
        file: path.basename(relPath),
        dest: `${path.dirname(relPath)}/`,
        note: err.message,
        automated: true
      }) + '\n';
      fs.appendFileSync(path.join(vaultPath, '_changelog.txt'), logLine);
    } catch {
      // swallow
    }
  }
}

main().then(() => process.exit(0)).catch(() => process.exit(0));

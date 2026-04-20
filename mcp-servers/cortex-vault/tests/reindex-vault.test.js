'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const reindexVault = require('../tools/reindex-vault.js');

describe('reindex_vault tool', { timeout: 180_000 }, () => {
  let vault;

  beforeEach(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-reindex-'));
    fs.writeFileSync(
      path.join(vault, 'note.md'),
      '# Sample\n\nBody text for the index.\n'
    );
  });

  afterEach(() => {
    if (vault) fs.rmSync(vault, { recursive: true, force: true });
  });

  test('returns a summary with indexed/skipped/removed counts', async () => {
    const res = await reindexVault.handler({}, vault);
    assert.equal(res.isError, undefined);
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.indexed, 1);
    assert.equal(data.skipped, 0);
    assert.equal(data.removed, 0);
    assert.ok(typeof data.elapsed_ms === 'number');
    assert.ok(typeof data.elapsed_human === 'string');
  });

  test('second run skips unchanged notes', async () => {
    await reindexVault.handler({}, vault);
    const res = await reindexVault.handler({}, vault);
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.indexed, 0);
    assert.equal(data.skipped, 1);
  });

  test('exports correct schema metadata', () => {
    assert.equal(reindexVault.name, 'reindex_vault');
  });
});

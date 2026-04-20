'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const CLI = path.join(__dirname, '..', 'bin', 'reindex-one.js');

describe('reindex-one CLI', { timeout: 120_000 }, () => {
  let vault;

  before(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-cli-'));
    fs.writeFileSync(path.join(vault, 'a.md'), '# A\n\nBody.\n');
  });

  after(() => {
    if (vault) fs.rmSync(vault, { recursive: true, force: true });
  });

  test('indexes a single note and exits 0', () => {
    const out = execFileSync('node', [CLI, vault, 'a.md'], { encoding: 'utf8' });
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.status, 'indexed');
    assert.equal(parsed.path, 'a.md');
  });

  test('second invocation on unchanged file reports skipped', () => {
    const out = execFileSync('node', [CLI, vault, 'a.md'], { encoding: 'utf8' });
    const parsed = JSON.parse(out.trim());
    assert.equal(parsed.status, 'skipped');
  });

  test('missing args exits 0 with no crash', () => {
    // should not throw
    execFileSync('node', [CLI], { encoding: 'utf8' });
  });

  test('invalid vault path exits 0 with no crash', () => {
    execFileSync('node', [CLI, '/definitely/not/a/vault/path/xyz', 'a.md'], {
      encoding: 'utf8'
    });
  });
});

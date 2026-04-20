'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { needsInstall, REQUIRED_DEPS } = require('../lib/bootstrap-check.js');

function mkdirp(p) {
  fs.mkdirSync(p, { recursive: true });
}

describe('bootstrap-check', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-bootstrap-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('returns true when node_modules is missing entirely', () => {
    assert.equal(needsInstall(dir), true);
  });

  test('returns true when node_modules exists but is empty', () => {
    mkdirp(path.join(dir, 'node_modules'));
    assert.equal(needsInstall(dir), true);
  });

  test('returns true when a required dep is missing', () => {
    // Populate all but one
    for (const dep of REQUIRED_DEPS.slice(0, -1)) {
      mkdirp(path.join(dir, 'node_modules', ...dep.split('/')));
    }
    assert.equal(needsInstall(dir), true);
  });

  test('returns false when all required deps are present', () => {
    for (const dep of REQUIRED_DEPS) {
      mkdirp(path.join(dir, 'node_modules', ...dep.split('/')));
    }
    assert.equal(needsInstall(dir), false);
  });

  test('REQUIRED_DEPS covers the five packages cortex-vault imports', () => {
    // Fail loudly if package.json dependencies ever drift out of sync with this list.
    const pkg = require('../package.json');
    const declared = Object.keys(pkg.dependencies || {});
    for (const dep of REQUIRED_DEPS) {
      assert.ok(
        declared.includes(dep),
        `REQUIRED_DEPS lists ${dep} but package.json does not declare it`
      );
    }
  });
});

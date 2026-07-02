'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { findClientFolders, backfill } = require('../bin/generate-dashboards.js');

function mkClient(vault, rel) {
  const abs = path.join(vault, rel);
  fs.mkdirSync(abs, { recursive: true });
  fs.writeFileSync(path.join(abs, '_MOC.md'),
    '---\ntype: client\n---\n\n# X\n\n## Projects\n\n## Notes\n');
}

describe('generate-dashboards backfill', () => {
  let vault;

  beforeEach(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-backfill-'));
    mkClient(vault, 'Work/TBL/Acme');
    mkClient(vault, 'Work/Personal/Me');
  });

  afterEach(() => {
    fs.rmSync(vault, { recursive: true, force: true });
  });

  test('finds client folders by type: client in _MOC frontmatter', () => {
    const found = findClientFolders(vault).sort();
    assert.deepEqual(found, ['Work/Personal/Me', 'Work/TBL/Acme']);
  });

  test('dry-run reports but writes nothing', () => {
    const plan = backfill(vault, false);
    assert.equal(plan.length, 2);
    assert.ok(!fs.existsSync(path.join(vault, 'Work/TBL/Acme/Acme — Projects.base')));
  });

  test('apply writes base files and embeds into MOC, idempotently', () => {
    backfill(vault, true);
    const basePath = path.join(vault, 'Work/TBL/Acme/Acme — Projects.base');
    assert.ok(fs.existsSync(basePath));
    const moc1 = fs.readFileSync(path.join(vault, 'Work/TBL/Acme/_MOC.md'), 'utf8');
    assert.match(moc1, /!\[\[Acme — Projects\.base\]\]/);

    // Second run: no duplicate embed, base untouched
    const baseBefore = fs.readFileSync(basePath, 'utf8');
    const plan2 = backfill(vault, true);
    assert.equal(plan2.length, 0);
    assert.equal(fs.readFileSync(basePath, 'utf8'), baseBefore);
    const moc2 = fs.readFileSync(path.join(vault, 'Work/TBL/Acme/_MOC.md'), 'utf8');
    assert.equal(moc2.split('Projects.base]]').length, 2, 'exactly one embed');
  });
});

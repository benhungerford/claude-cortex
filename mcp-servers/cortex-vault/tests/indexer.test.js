'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { indexVault, indexOne } = require('../lib/indexer.js');
const { openDb } = require('../lib/search-db.js');

function makeVault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-idx-test-'));
  // Seed three notes across subfolders
  fs.mkdirSync(path.join(dir, 'Work', 'ClientA', 'ProjectX'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'Knowledge Base'), { recursive: true });
  fs.mkdirSync(path.join(dir, '_Templates'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'Archives', 'dead-project'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cortex'), { recursive: true });

  fs.writeFileSync(
    path.join(dir, 'Work', 'ClientA', 'ProjectX', 'meeting.md'),
    `---\ntype: meeting-notes\n---\n# Checkout abandonment call\n\nDiscussed cart drop-off and payment friction.\n`
  );
  fs.writeFileSync(
    path.join(dir, 'Knowledge Base', 'shopify-checkout.md'),
    `# Shopify Checkout Patterns\n\nReusable notes on extending the checkout.\n`
  );
  fs.writeFileSync(
    path.join(dir, 'Work', 'ClientA', 'ProjectX', 'tech-stack.md'),
    `# Tech Stack\n\nNext.js + Shopify Storefront API.\n`
  );

  // These should be SKIPPED
  fs.writeFileSync(path.join(dir, '_Templates', 'tpl.md'), '# Template — do not index\n');
  fs.writeFileSync(
    path.join(dir, 'Archives', 'dead-project', 'old.md'),
    '# Archived — do not index\n'
  );
  fs.writeFileSync(path.join(dir, '.cortex', 'junk.md'), '# hidden — do not index\n');

  return dir;
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('indexer', { timeout: 120_000 }, () => {
  let vault;

  beforeEach(() => {
    vault = makeVault();
  });

  afterEach(() => {
    rmDir(vault);
  });

  test('indexes all .md files and skips excluded folders', async () => {
    const result = await indexVault(vault);
    assert.equal(result.indexed, 3, 'should index 3 notes');
    assert.equal(result.removed, 0);
    assert.ok(result.elapsed_ms >= 0);

    const db = openDb(vault);
    const rows = db.prepare('SELECT path FROM notes ORDER BY path').all();
    db.close();

    const paths = rows.map((r) => r.path);
    assert.equal(paths.length, 3);
    assert.ok(paths.includes('Knowledge Base/shopify-checkout.md'));
    assert.ok(paths.includes('Work/ClientA/ProjectX/meeting.md'));
    assert.ok(paths.includes('Work/ClientA/ProjectX/tech-stack.md'));
    // Excluded
    assert.ok(!paths.some((p) => p.startsWith('_Templates/')));
    assert.ok(!paths.some((p) => p.startsWith('Archives/')));
    assert.ok(!paths.some((p) => p.startsWith('.cortex/')));
  });

  test('re-running is a no-op (all skipped)', async () => {
    await indexVault(vault);
    const result = await indexVault(vault);
    assert.equal(result.indexed, 0);
    assert.equal(result.skipped, 3);
    assert.equal(result.removed, 0);
  });

  test('detects removed files on re-index', async () => {
    await indexVault(vault);
    fs.rmSync(path.join(vault, 'Knowledge Base', 'shopify-checkout.md'));

    const result = await indexVault(vault);
    assert.equal(result.removed, 1);

    const db = openDb(vault);
    const row = db
      .prepare('SELECT path FROM notes WHERE path=?')
      .get('Knowledge Base/shopify-checkout.md');
    db.close();
    assert.equal(row, undefined, 'removed file should be deleted from DB');
  });

  test('re-embeds when content changes', async () => {
    await indexVault(vault);
    const db1 = openDb(vault);
    const before = db1
      .prepare('SELECT hash FROM notes WHERE path=?')
      .get('Work/ClientA/ProjectX/meeting.md');
    db1.close();

    fs.writeFileSync(
      path.join(vault, 'Work', 'ClientA', 'ProjectX', 'meeting.md'),
      `# Updated title\n\nTotally different content now.\n`
    );

    const result = await indexVault(vault);
    assert.equal(result.indexed, 1);
    assert.equal(result.skipped, 2);

    const db2 = openDb(vault);
    const after = db2
      .prepare('SELECT hash, title FROM notes WHERE path=?')
      .get('Work/ClientA/ProjectX/meeting.md');
    db2.close();

    assert.notEqual(after.hash, before.hash);
    assert.equal(after.title, 'Updated title');
  });

  test('indexOne updates a single file without touching others', async () => {
    await indexVault(vault);

    fs.writeFileSync(
      path.join(vault, 'Work', 'ClientA', 'ProjectX', 'meeting.md'),
      '# Edited just this one\n\nContent change.\n'
    );
    const res = await indexOne(vault, 'Work/ClientA/ProjectX/meeting.md');
    assert.equal(res.status, 'indexed');

    const db = openDb(vault);
    const row = db
      .prepare('SELECT title FROM notes WHERE path=?')
      .get('Work/ClientA/ProjectX/meeting.md');
    const count = db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
    db.close();

    assert.equal(row.title, 'Edited just this one');
    assert.equal(count, 3, 'other rows should be untouched');
  });

  test('indexOne skips excluded paths', async () => {
    const res = await indexOne(vault, '_Templates/tpl.md');
    assert.equal(res.status, 'skipped-excluded');
  });

  test('indexOne removes DB row when file no longer exists', async () => {
    await indexVault(vault);
    fs.rmSync(path.join(vault, 'Work', 'ClientA', 'ProjectX', 'tech-stack.md'));

    const res = await indexOne(vault, 'Work/ClientA/ProjectX/tech-stack.md');
    assert.equal(res.status, 'removed');

    const db = openDb(vault);
    const row = db
      .prepare('SELECT path FROM notes WHERE path=?')
      .get('Work/ClientA/ProjectX/tech-stack.md');
    db.close();
    assert.equal(row, undefined);
  });
});

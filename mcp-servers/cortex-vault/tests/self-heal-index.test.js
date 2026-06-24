'use strict';

// Self-heal regression test (Cowork / hookless-surface support).
//
// On surfaces where the post-tool-use re-embed hook never fires (Cowork, iPad),
// the semantic index would drift as notes are written. recall_related and
// search_vault must self-heal: when the cheap freshness gate reports staleness
// (vault _changelog.txt newer than the index), they run the incremental indexer
// before querying, so a brand-new note is found without a manual /cortex-index.

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { indexVault } = require('../lib/indexer.js');
const recallRelated = require('../tools/recall-related.js');
const searchVault = require('../tools/search-vault.js');

function writeNote(dir, rel, content) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

// Make the index look older than the vault: build the index, then stamp
// _changelog.txt into the past, then write a new note + bump the changelog so
// freshness reports stale (vault_changed > index_updated).
async function buildThenStale(vault) {
  writeNote(vault, '_changelog.txt', '[init] seed\n');
  writeNote(vault, 'alpha.md', '# Alpha\nCheckout payment flow with Stripe.\n');
  await indexVault(vault);
  const past = (Date.now() - 120000) / 1000;
  fs.utimesSync(path.join(vault, '_changelog.txt'), past, past);
  // Brand-new note the index has never seen.
  writeNote(vault, 'beta.md', '# Beta\nCart abandonment recovery and discount codes.\n');
  fs.appendFileSync(path.join(vault, '_changelog.txt'), '[now] added beta\n');
}

describe('stale-index self-heal', { timeout: 180_000 }, () => {
  let vault;

  beforeEach(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-selfheal-'));
    delete process.env.CORTEX_NO_AUTO_REINDEX;
  });

  afterEach(() => {
    fs.rmSync(vault, { recursive: true, force: true });
    delete process.env.CORTEX_NO_AUTO_REINDEX;
  });

  test('recall_related self-heals a stale index and finds the new note', async () => {
    await buildThenStale(vault);
    const res = await recallRelated.handler(
      { context: 'cart abandonment discounts', limit: 5, min_score: 0 },
      vault
    );
    const payload = JSON.parse(res.content[0].text);
    assert.equal(payload.index_refreshed, true, 'should report the index was refreshed');
    assert.ok(
      payload.results.some((r) => r.path === 'beta.md'),
      'should surface the brand-new note after self-heal'
    );
  });

  test('search_vault self-heals a stale index and finds the new note', async () => {
    await buildThenStale(vault);
    const res = await searchVault.handler(
      { query: 'cart abandonment discounts', limit: 5, min_score: 0 },
      vault
    );
    const payload = JSON.parse(res.content[0].text);
    assert.equal(payload.index_refreshed, true, 'should report the index was refreshed');
    assert.ok(
      payload.results.some((r) => r.path === 'beta.md'),
      'should surface the brand-new note after self-heal'
    );
  });

  test('CORTEX_NO_AUTO_REINDEX=1 opts out — index stays stale, not refreshed', async () => {
    await buildThenStale(vault);
    process.env.CORTEX_NO_AUTO_REINDEX = '1';
    const res = await searchVault.handler(
      { query: 'cart abandonment discounts', limit: 5, min_score: 0 },
      vault
    );
    const payload = JSON.parse(res.content[0].text);
    assert.notEqual(payload.index_refreshed, true, 'should NOT self-heal when opted out');
    assert.equal(payload.index_stale, true, 'should still flag the index as stale');
    assert.ok(
      !payload.results.some((r) => r.path === 'beta.md'),
      'new note must not appear without a reindex'
    );
  });
});

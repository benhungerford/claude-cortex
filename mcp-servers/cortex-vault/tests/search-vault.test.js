'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { indexVault } = require('../lib/indexer.js');
const searchVault = require('../tools/search-vault.js');

function writeNote(dir, rel, content) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

describe('search_vault tool', { timeout: 180_000 }, () => {
  let vault;

  before(async () => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-searchvault-'));

    writeNote(
      vault,
      'Work/ClientA/checkout.md',
      `# Checkout abandonment deep dive\n\nCustomers are dropping off at the payment step. We're seeing cart abandonment spike on mobile.\n`
    );
    writeNote(
      vault,
      'Work/ClientB/auth.md',
      `# SSO authentication setup\n\nConfiguring Single Sign-On with miniOrange and SAML.\n`
    );
    writeNote(
      vault,
      'Knowledge Base/recipes.md',
      `# Margherita pizza\n\nClassic Neapolitan recipe with fresh basil and buffalo mozzarella.\n`
    );

    await indexVault(vault);
  });

  after(() => {
    if (vault) fs.rmSync(vault, { recursive: true, force: true });
  });

  test('returns top result semantically matching the query', async () => {
    const res = await searchVault.handler({ query: 'cart drop-off and payment friction' }, vault);
    assert.equal(res.isError, undefined);
    const data = JSON.parse(res.content[0].text);
    assert.ok(data.results.length >= 1);
    assert.equal(data.results[0].path, 'Work/ClientA/checkout.md');
  });

  test('respects the limit parameter', async () => {
    const res = await searchVault.handler({ query: 'anything', limit: 2 }, vault);
    const data = JSON.parse(res.content[0].text);
    assert.ok(data.results.length <= 2);
  });

  test('results include path, title, score, and snippet', async () => {
    // min_score:0 so the field-shape assertion is independent of the floor.
    const res = await searchVault.handler({ query: 'checkout', min_score: 0 }, vault);
    const data = JSON.parse(res.content[0].text);
    const top = data.results[0];
    assert.ok(typeof top.path === 'string');
    assert.ok(typeof top.title === 'string');
    assert.ok(typeof top.score === 'number');
    assert.ok(typeof top.snippet === 'string');
  });

  test('errors on empty query', async () => {
    const res = await searchVault.handler({ query: '' }, vault);
    assert.equal(res.isError, true);
  });

  test('exports correct schema metadata', () => {
    assert.equal(searchVault.name, 'search_vault');
    assert.equal(searchVault.inputSchema.required[0], 'query');
  });

  // W2.3 — scope + min_score + attribution.
  test('include_paths restricts search to the scoped subtree', async () => {
    const res = await searchVault.handler(
      { query: 'authentication', include_paths: ['Work/ClientB'], min_score: 0 },
      vault
    );
    const data = JSON.parse(res.content[0].text);
    assert.ok(data.results.every((r) => r.path.startsWith('Work/ClientB/')));
  });

  test('min_score is enforced server-side', async () => {
    const res = await searchVault.handler(
      { query: 'checkout', min_score: 0.99 },
      vault
    );
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.min_score, 0.99);
    assert.ok(data.results.every((r) => r.score >= 0.99));
  });

  test('results carry a project attribution field', async () => {
    const res = await searchVault.handler({ query: 'checkout', min_score: 0 }, vault);
    const data = JSON.parse(res.content[0].text);
    assert.ok(data.results.length >= 1);
    assert.equal(typeof data.results[0].project, 'string');
    assert.equal(data.results[0].project, 'Work');
  });

  test('schema advertises include_paths, scope, and min_score', () => {
    const props = searchVault.inputSchema.properties;
    assert.ok(props.include_paths);
    assert.ok(props.scope);
    assert.ok(props.min_score);
  });
});

// W2.2 — empty-index signal.
describe('search_vault index_empty signal (W2.2)', { timeout: 120_000 }, () => {
  let vault;

  before(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-searchvault-empty-'));
    writeNote(vault, 'Work/note.md', '# A note\n\nContent.\n');
    // No indexVault call — DB is empty.
  });

  after(() => {
    if (vault) fs.rmSync(vault, { recursive: true, force: true });
  });

  test('reports index_empty for a never-built index', async () => {
    const res = await searchVault.handler({ query: 'anything' }, vault);
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.count, 0);
    assert.equal(data.index_empty, true);
    assert.match(data.note, /cortex-index/);
  });
});

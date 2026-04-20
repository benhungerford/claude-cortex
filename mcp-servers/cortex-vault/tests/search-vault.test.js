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
    const res = await searchVault.handler({ query: 'checkout' }, vault);
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
});

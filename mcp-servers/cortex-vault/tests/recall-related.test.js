'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { indexVault } = require('../lib/indexer.js');
const recallRelated = require('../tools/recall-related.js');

function writeNote(dir, rel, content) {
  const abs = path.join(dir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

describe('recall_related tool', { timeout: 180_000 }, () => {
  let vault;

  before(async () => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-recall-'));

    writeNote(
      vault,
      'Work/FKT/auth.md',
      `# Single Sign-On with SAML\n\n## Provider selection\n\n## IdP configuration\n\nNotes on setting up SAML-based SSO with miniOrange for the FKT Shopify build.\n`
    );
    writeNote(
      vault,
      'Work/YW/sso.md',
      `# ywPortal SSO implementation\n\n## SAML handshake\n\nIntegration notes for the ywPortal WordPress build using miniOrange SSO.\n`
    );
    writeNote(
      vault,
      'Knowledge Base/baking.md',
      `# Sourdough bread\n\nOvernight bulk ferment with 80% hydration dough.\n`
    );

    await indexVault(vault);
  });

  after(() => {
    if (vault) fs.rmSync(vault, { recursive: true, force: true });
  });

  test('returns related notes ranked by similarity', async () => {
    const res = await recallRelated.handler(
      { context: 'implementing single sign-on with SAML' },
      vault
    );
    assert.equal(res.isError, undefined);
    const data = JSON.parse(res.content[0].text);
    assert.ok(data.results.length >= 2);
    // Both SSO notes should outrank the baking note
    const topPaths = data.results.slice(0, 2).map((r) => r.path);
    assert.ok(topPaths.includes('Work/FKT/auth.md'));
    assert.ok(topPaths.includes('Work/YW/sso.md'));
  });

  test('excludes paths passed in exclude_paths', async () => {
    const res = await recallRelated.handler(
      {
        context: 'single sign-on setup',
        exclude_paths: ['Work/FKT/auth.md']
      },
      vault
    );
    const data = JSON.parse(res.content[0].text);
    assert.ok(!data.results.some((r) => r.path === 'Work/FKT/auth.md'));
  });

  test('results include why (keyword hints)', async () => {
    const res = await recallRelated.handler({ context: 'SSO' }, vault);
    const data = JSON.parse(res.content[0].text);
    const top = data.results[0];
    assert.ok(Array.isArray(top.why));
    assert.ok(top.why.length >= 1, 'why should contain at least one keyword');
  });

  test('errors on empty context', async () => {
    const res = await recallRelated.handler({ context: '' }, vault);
    assert.equal(res.isError, true);
  });

  test('truncates oversized context gracefully', async () => {
    const huge = 'SAML SSO '.repeat(5000);
    const res = await recallRelated.handler({ context: huge }, vault);
    assert.equal(res.isError, undefined);
  });

  test('exports correct schema metadata', () => {
    assert.equal(recallRelated.name, 'recall_related');
    assert.equal(recallRelated.inputSchema.required[0], 'context');
  });
});

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

  // Ranking/exclusion/field-shape tests pass min_score:0 so they exercise the
  // behavior under test independently of the W2.3 relevance floor (which has
  // its own dedicated tests). With score = 1 - distance/2, even strong matches
  // on this tiny corpus sit ~0.5–0.65, below the ~0.7 ambient default.
  test('returns related notes ranked by similarity', async () => {
    const res = await recallRelated.handler(
      { context: 'implementing single sign-on with SAML', min_score: 0 },
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
        exclude_paths: ['Work/FKT/auth.md'],
        min_score: 0
      },
      vault
    );
    const data = JSON.parse(res.content[0].text);
    assert.ok(!data.results.some((r) => r.path === 'Work/FKT/auth.md'));
  });

  test('results include why (keyword hints)', async () => {
    const res = await recallRelated.handler({ context: 'SSO', min_score: 0 }, vault);
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

  // W2.3 — scope + min_score + attribution.
  test('include_paths restricts results to the scoped subtree', async () => {
    const res = await recallRelated.handler(
      {
        context: 'single sign-on with SAML',
        include_paths: ['Work/FKT'],
        min_score: 0 // disable floor so scope is the only filter under test
      },
      vault
    );
    const data = JSON.parse(res.content[0].text);
    assert.ok(data.results.length >= 1);
    assert.ok(
      data.results.every((r) => r.path.startsWith('Work/FKT/')),
      'every result must be inside Work/FKT'
    );
    // The YW note must be excluded by scope even though it is highly similar.
    assert.ok(!data.results.some((r) => r.path === 'Work/YW/sso.md'));
  });

  test('scope alias works like a single include_paths prefix', async () => {
    const res = await recallRelated.handler(
      { context: 'SSO', scope: 'Work/YW', min_score: 0 },
      vault
    );
    const data = JSON.parse(res.content[0].text);
    assert.ok(data.results.every((r) => r.path.startsWith('Work/YW/')));
  });

  test('min_score filters low-similarity noise server-side', async () => {
    const res = await recallRelated.handler(
      { context: 'single sign-on with SAML', min_score: 0.99 },
      vault
    );
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.min_score, 0.99);
    assert.ok(data.results.every((r) => r.score >= 0.99));
  });

  test('results carry a project attribution field', async () => {
    const res = await recallRelated.handler(
      { context: 'single sign-on', min_score: 0 },
      vault
    );
    const data = JSON.parse(res.content[0].text);
    const fkt = data.results.find((r) => r.path === 'Work/FKT/auth.md');
    assert.ok(fkt, 'FKT note should be present');
    assert.equal(fkt.project, 'Work');
  });

  test('schema advertises include_paths, scope, and min_score', () => {
    const props = recallRelated.inputSchema.properties;
    assert.ok(props.include_paths);
    assert.ok(props.scope);
    assert.ok(props.min_score);
  });
});

// W2.2 — empty-index signal (separate vault that is never indexed).
describe('recall_related index_empty signal (W2.2)', { timeout: 120_000 }, () => {
  let vault;

  before(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-recall-empty-'));
    writeNote(vault, 'Work/note.md', '# A note\n\nSome content about checkout flows.\n');
    // Intentionally NOT calling indexVault — the index DB starts empty.
  });

  after(() => {
    if (vault) fs.rmSync(vault, { recursive: true, force: true });
  });

  test('reports index_empty instead of a bare zero-count no-match', async () => {
    const res = await recallRelated.handler({ context: 'checkout flow' }, vault);
    const data = JSON.parse(res.content[0].text);
    assert.equal(data.count, 0);
    assert.equal(data.index_empty, true);
    assert.match(data.note, /cortex-index/);
  });
});

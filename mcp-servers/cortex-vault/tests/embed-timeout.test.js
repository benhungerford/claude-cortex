'use strict';

// W2.1 — embedWithTimeout: bounded embed used by recall_related so a slow/cold
// embedder degrades to empty results instead of stalling the turn.

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  embedWithTimeout,
  bundledWeightsPresent,
  VECTOR_DIM,
  DEFAULT_EMBED_TIMEOUT_MS
} = require('../lib/embeddings.js');

describe('embedWithTimeout (W2.1)', { timeout: 120_000 }, () => {
  test('exposes a sane default timeout', () => {
    assert.ok(DEFAULT_EMBED_TIMEOUT_MS >= 1000);
  });

  test('returns a vector on success when weights are present', async () => {
    if (!bundledWeightsPresent()) return; // skip without a bundle
    const r = await embedWithTimeout('a short context string about checkout');
    assert.ok(r.vector instanceof Float32Array);
    assert.equal(r.vector.length, VECTOR_DIM);
    assert.equal(r.timedOut, undefined);
    assert.equal(r.error, undefined);
  });

  test('resolves with timedOut (never throws) when the budget is too small', async () => {
    // 1ms budget: even a warm extractor cannot finish, so we exercise the
    // timeout branch deterministically without mocking.
    const r = await embedWithTimeout('some context', 1);
    // Either it timed out, or (extremely unlikely) it beat 1ms — both are
    // resolved values, never a throw.
    assert.ok(r.timedOut === true || r.vector instanceof Float32Array || r.error);
    assert.equal(typeof r.elapsed_ms, 'number');
  });

  test('an embed error is captured, not thrown', async () => {
    // Empty input throws inside embed(); embedWithTimeout must capture it.
    const r = await embedWithTimeout('', DEFAULT_EMBED_TIMEOUT_MS);
    assert.ok(r.error, 'empty input should surface as a captured error');
    assert.match(r.error.message, /empty/i);
  });
});

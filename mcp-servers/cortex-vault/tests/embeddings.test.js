'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const fs = require('node:fs');
const path = require('node:path');

const {
  embed,
  warmExtractor,
  bundledWeightsPresent,
  VECTOR_DIM,
  MAX_CHARS,
  MODELS_DIR,
  WEIGHT_FILE,
  MODEL_ID
} = require('../lib/embeddings.js');

function cosine(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

describe('embeddings', { timeout: 120_000 }, () => {
  let embCart;
  let embCheckout;
  let embPizza;

  before(async () => {
    embCart = await embed('shopping cart abandonment during checkout');
    embCheckout = await embed('customers dropping off before payment');
    embPizza = await embed('classic margherita pizza recipe with fresh basil');
  });

  test('returns a Float32Array of VECTOR_DIM length', () => {
    assert.ok(embCart instanceof Float32Array);
    assert.equal(embCart.length, VECTOR_DIM);
  });

  test('produces normalized vectors (unit length)', () => {
    const norm = Math.sqrt(cosine(embCart, embCart));
    assert.ok(
      Math.abs(norm - 1) < 0.01,
      `expected unit-length vector, got norm=${norm}`
    );
  });

  test('related texts score higher than unrelated texts', () => {
    const related = cosine(embCart, embCheckout);
    const unrelated = cosine(embCart, embPizza);
    assert.ok(
      related > unrelated,
      `expected related(${related.toFixed(3)}) > unrelated(${unrelated.toFixed(3)})`
    );
  });

  test('rejects empty input', async () => {
    await assert.rejects(() => embed(''), /empty/i);
    await assert.rejects(() => embed('   \n  '), /empty/i);
  });

  test('truncates text longer than MAX_CHARS without throwing', async () => {
    const huge = 'shopify '.repeat(MAX_CHARS); // way over cap
    const v = await embed(huge);
    assert.equal(v.length, VECTOR_DIM);
  });
});

// W2.8 — offline pin + bundled-weights guard.
describe('embeddings offline pin (W2.8)', { timeout: 120_000 }, () => {
  test('WEIGHT_FILE resolves under the bundled models/ dir', () => {
    assert.ok(WEIGHT_FILE.startsWith(MODELS_DIR), 'weight must live under models/');
    assert.ok(
      WEIGHT_FILE.includes(path.join(MODEL_ID, 'onnx', 'model.onnx')),
      'weight path must mirror the HF Hub repo layout'
    );
  });

  test('bundledWeightsPresent reflects the on-disk weight file', () => {
    const onDisk = fs.existsSync(WEIGHT_FILE) && fs.statSync(WEIGHT_FILE).size > 0;
    assert.equal(bundledWeightsPresent(), onDisk);
  });

  test('warmExtractor never throws; resolves to a boolean', async () => {
    const warmed = await warmExtractor();
    assert.equal(typeof warmed, 'boolean');
    // When the bundle is present (CI/dev), warming should succeed.
    if (bundledWeightsPresent()) {
      assert.equal(warmed, true);
    }
  });

  test('embed works offline when bundled weights are present', async () => {
    if (!bundledWeightsPresent()) return; // skip if no bundle in this env
    const v = await embed('offline embedding from bundled weights');
    assert.equal(v.length, VECTOR_DIM);
  });
});

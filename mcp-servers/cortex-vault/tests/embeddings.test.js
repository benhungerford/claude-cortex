'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const { embed, VECTOR_DIM, MAX_CHARS } = require('../lib/embeddings.js');

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

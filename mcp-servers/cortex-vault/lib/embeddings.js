'use strict';

const fs = require('node:fs');
const path = require('node:path');

const VECTOR_DIM = 384;
const MAX_CHARS = 2000;
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

// W2.8 — true-offline pin. The embedding model is loaded ONLY from a bundled
// local directory; no network call is ever made. `localModelPath` is the root
// under which @huggingface/transformers resolves `<MODEL_ID>/...`, mirroring
// the Hugging Face Hub repo layout. The ~86MB onnx weight is git-ignored (see
// models/README.md) but must be present on disk at runtime.
const MODELS_DIR = path.join(__dirname, '..', 'models');
const WEIGHT_FILE = path.join(MODELS_DIR, MODEL_ID, 'onnx', 'model.onnx');

let extractorPromise = null;

function bundledWeightsPresent() {
  try {
    return fs.statSync(WEIGHT_FILE).size > 0;
  } catch {
    return false;
  }
}

function missingWeightsError() {
  return new Error(
    `Embedding model weights are not bundled — semantic search is unavailable.\n` +
    `Expected: ${WEIGHT_FILE}\n` +
    `Cortex runs the ${MODEL_ID} model fully offline and will NOT download it.\n` +
    `To enable semantic search, place the model.onnx weight at the path above.\n` +
    `See ${path.join(MODELS_DIR, 'README.md')} for instructions.`
  );
}

async function getExtractor() {
  if (!extractorPromise) {
    // Fail fast (and cache nothing) if the weights are absent, so a missing
    // bundle produces one clear error instead of a silent network fetch.
    if (!bundledWeightsPresent()) {
      throw missingWeightsError();
    }
    const { pipeline, env } = await import('@huggingface/transformers');
    // Offline pin: load from the bundled models/ dir only, never the network.
    env.allowLocalModels = true;
    env.allowRemoteModels = false;
    env.localModelPath = MODELS_DIR;
    // Point the FS cache at the bundle too, so a fresh process never writes to
    // (or reads from) the package's hidden .cache and never reaches out.
    env.cacheDir = MODELS_DIR;
    extractorPromise = pipeline('feature-extraction', MODEL_ID).catch((err) => {
      // Don't poison the singleton — a transient load failure should be retryable.
      extractorPromise = null;
      throw err;
    });
  }
  return extractorPromise;
}

// W2.1 — eager warm. Fire-and-forget from server.js main() before connecting
// transport so the first real recall pays warm latency, not cold-start. Never
// throws to the caller; swallow + log so a missing bundle can't crash boot.
function warmExtractor() {
  return getExtractor().then(
    () => true,
    (err) => {
      try {
        process.stderr.write(`[cortex-vault] embedder warm skipped: ${err.message}\n`);
      } catch {
        // ignore logging failures
      }
      return false;
    }
  );
}

async function embed(text) {
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('embed: input is empty');
  }
  const clipped = text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) : text;
  const extractor = await getExtractor();
  const output = await extractor(clipped, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data);
}

// W2.1 — bounded embed. Wraps embed() with a timeout so an ambient recall on a
// cold/slow process degrades to "empty results + a log" instead of stalling the
// turn for seconds. Returns { vector } on success, or { timedOut: true } /
// { error } so the caller can return empty results without throwing.
const DEFAULT_EMBED_TIMEOUT_MS = 4000;

function embedWithTimeout(text, timeoutMs = DEFAULT_EMBED_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ timedOut: true, elapsed_ms: timeoutMs });
    }, timeoutMs);
    const started = Date.now();
    embed(text).then(
      (vector) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ vector, elapsed_ms: Date.now() - started });
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({ error, elapsed_ms: Date.now() - started });
      }
    );
  });
}

module.exports = {
  embed,
  embedWithTimeout,
  warmExtractor,
  bundledWeightsPresent,
  VECTOR_DIM,
  MAX_CHARS,
  MODEL_ID,
  WEIGHT_FILE,
  MODELS_DIR,
  DEFAULT_EMBED_TIMEOUT_MS
};

'use strict';

const VECTOR_DIM = 384;
const MAX_CHARS = 2000;
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    const { pipeline, env } = await import('@huggingface/transformers');
    // Silence progress spam during tool calls; keep warnings.
    env.allowLocalModels = true;
    extractorPromise = pipeline('feature-extraction', MODEL_ID);
  }
  return extractorPromise;
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

module.exports = { embed, VECTOR_DIM, MAX_CHARS, MODEL_ID };

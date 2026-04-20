'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getVaultPath } = require('../lib/vault-path.js');
const { openDb } = require('../lib/search-db.js');
const { embed, MAX_CHARS } = require('../lib/embeddings.js');
const { parseFrontmatter } = require('../lib/indexer.js');

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','into','your','have','been','are','but',
  'not','you','our','was','were','had','has','its','their','they','them','about','just',
  'what','when','where','which','while','should','would','could','will','can','also',
  'than','then','over','under','into','onto','per','via','vs','per','like'
]);

function extractWhy(vaultPath, relPath, title) {
  const terms = new Set();
  if (title) {
    for (const t of title.toLowerCase().split(/\W+/)) {
      if (t.length >= 4 && !STOPWORDS.has(t)) terms.add(t);
    }
  }
  try {
    const abs = path.join(vaultPath, relPath);
    const content = fs.readFileSync(abs, 'utf8');
    const { body } = parseFrontmatter(content);
    const h2Matches = body.match(/^##+\s+(.+)$/gm) || [];
    for (const h of h2Matches.slice(0, 3)) {
      for (const t of h.toLowerCase().split(/\W+/)) {
        if (t.length >= 4 && !STOPWORDS.has(t)) terms.add(t);
      }
    }
  } catch {
    // ignore
  }
  return Array.from(terms).slice(0, 3);
}

async function handler(args, vaultOverride) {
  const { context, limit = 5, exclude_paths = [] } = args;

  if (!context || typeof context !== 'string' || context.trim().length === 0) {
    return {
      content: [{ type: 'text', text: 'context is required (non-empty string)' }],
      isError: true
    };
  }

  const k = Math.max(1, Math.min(50, Number(limit) || 5));
  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const truncated = context.length > MAX_CHARS ? context.slice(0, MAX_CHARS) : context;
  const vector = await embed(truncated);

  const db = openDb(vault);
  try {
    // Fetch a few more than needed so we can filter out exclude_paths without losing k.
    const fetchK = Math.min(50, k + exclude_paths.length + 3);
    const rows = db
      .prepare(
        `SELECT n.path AS path, n.title AS title, v.distance AS distance
         FROM vec_notes v
         JOIN notes n ON n.id = v.rowid
         WHERE v.embedding MATCH ? AND v.k = ?
         ORDER BY v.distance`
      )
      .all(vector, fetchK);

    const excluded = new Set(exclude_paths);
    const results = rows
      .filter((r) => !excluded.has(r.path))
      .slice(0, k)
      .map((r) => ({
        path: r.path,
        title: r.title,
        score: Number((1 - r.distance / 2).toFixed(4)),
        why: extractWhy(vault, r.path, r.title)
      }));

    return {
      content: [
        { type: 'text', text: JSON.stringify({ count: results.length, results }, null, 2) }
      ]
    };
  } finally {
    db.close();
  }
}

module.exports = {
  name: 'recall_related',
  description:
    'Silently recall notes semantically related to the current working context. Call this proactively (not only when asked) at the start of a new task, when the user mentions a vendor/tool/pattern, or when hitting a blocker — so you can surface prior vault knowledge the user may have forgotten. Use exclude_paths to skip the file currently being edited.',
  inputSchema: {
    type: 'object',
    properties: {
      context: {
        type: 'string',
        description: 'A chunk of text describing what you are currently working on (user request, code snippet, file excerpt, etc).'
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 5, max 50).',
        default: 5
      },
      exclude_paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Vault-relative paths to exclude from results (e.g. the file currently being edited).',
        default: []
      }
    },
    required: ['context']
  },
  handler
};

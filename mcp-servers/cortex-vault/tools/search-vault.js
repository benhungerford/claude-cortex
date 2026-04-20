'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getVaultPath } = require('../lib/vault-path.js');
const { openDb } = require('../lib/search-db.js');
const { embed } = require('../lib/embeddings.js');
const { parseFrontmatter } = require('../lib/indexer.js');

const SNIPPET_LEN = 200;

function buildSnippet(vaultPath, relPath) {
  try {
    const abs = path.join(vaultPath, relPath);
    const content = fs.readFileSync(abs, 'utf8');
    const { body } = parseFrontmatter(content);
    const clean = body.replace(/^#+\s+.*$/m, '').replace(/\s+/g, ' ').trim();
    return clean.length > SNIPPET_LEN ? clean.slice(0, SNIPPET_LEN) + '…' : clean;
  } catch {
    return '';
  }
}

async function handler(args, vaultOverride) {
  const { query, limit = 5 } = args;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return {
      content: [{ type: 'text', text: 'query is required (non-empty string)' }],
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

  const vector = await embed(query);
  const db = openDb(vault);

  try {
    const rows = db
      .prepare(
        `SELECT n.path AS path, n.title AS title, v.distance AS distance
         FROM vec_notes v
         JOIN notes n ON n.id = v.rowid
         WHERE v.embedding MATCH ? AND v.k = ?
         ORDER BY v.distance`
      )
      .all(vector, k);

    const results = rows.map((r) => ({
      path: r.path,
      title: r.title,
      score: Number((1 - r.distance / 2).toFixed(4)),
      snippet: buildSnippet(vault, r.path)
    }));

    return {
      content: [
        { type: 'text', text: JSON.stringify({ query, count: results.length, results }, null, 2) }
      ]
    };
  } finally {
    db.close();
  }
}

module.exports = {
  name: 'search_vault',
  description:
    'Semantic search over the vault. Returns notes most related in meaning to the query, not keyword matches. Use when the user asks to find something and you do not know exactly where it lives.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural-language query describing what you want to find.'
      },
      limit: {
        type: 'number',
        description: 'Max results to return (default 5, max 50).',
        default: 5
      }
    },
    required: ['query']
  },
  handler
};

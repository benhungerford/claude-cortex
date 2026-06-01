'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getVaultPath } = require('../lib/vault-path.js');
const { openDb, indexFreshness } = require('../lib/search-db.js');
const { embed } = require('../lib/embeddings.js');
const {
  parseFrontmatter,
  projectSegment,
  buildScopeMatcher
} = require('../lib/indexer.js');

const SNIPPET_LEN = 200;

// W2.3 — explicit search keeps a lower floor than ambient recall: the user
// asked, so we tolerate weaker matches. Still server-side-enforced.
const DEFAULT_MIN_SCORE = 0.5;

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

function resolveIncludePaths(args) {
  const out = [];
  if (Array.isArray(args.include_paths)) out.push(...args.include_paths);
  else if (typeof args.include_paths === 'string' && args.include_paths) out.push(args.include_paths);
  if (Array.isArray(args.scope)) out.push(...args.scope);
  else if (typeof args.scope === 'string' && args.scope) out.push(args.scope);
  return out;
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
  const minScore =
    args.min_score === undefined || args.min_score === null
      ? DEFAULT_MIN_SCORE
      : Math.max(0, Math.min(1, Number(args.min_score)));
  const includePaths = resolveIncludePaths(args);
  const inScope = buildScopeMatcher(includePaths);

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
    // W2.2 — distinguish a never-built index from a real no-match.
    const freshness = indexFreshness(vault, db);
    if (freshness.empty) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query,
                count: 0,
                results: [],
                index_empty: true,
                note: 'Semantic index is empty — run /cortex-index to build it.'
              },
              null,
              2
            )
          }
        ]
      };
    }

    // Fetch extra so scope/score filtering doesn't starve k.
    const fetchK = Math.min(50, k + includePaths.length + 10);
    const rows = db
      .prepare(
        `SELECT n.path AS path, n.title AS title, v.distance AS distance
         FROM vec_notes v
         JOIN notes n ON n.id = v.rowid
         WHERE v.embedding MATCH ? AND v.k = ?
         ORDER BY v.distance`
      )
      .all(vector, fetchK);

    const results = rows
      .filter((r) => inScope(r.path)) // W2.3 — server-side scope enforcement
      .map((r) => ({
        path: r.path,
        project: projectSegment(r.path), // W2.3 — attribution
        title: r.title,
        score: Number((1 - r.distance / 2).toFixed(4)),
        snippet: buildSnippet(vault, r.path)
      }))
      .filter((r) => r.score >= minScore) // W2.3 — server-side min_score
      .slice(0, k);

    const payload = { query, count: results.length, results, min_score: minScore };
    if (includePaths.length > 0) payload.scope = includePaths;
    if (freshness.stale) {
      payload.index_stale = true;
      payload.note = 'Semantic index may be stale — run /cortex-index to refresh.';
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }]
    };
  } finally {
    db.close();
  }
}

module.exports = {
  name: 'search_vault',
  description:
    'Semantic search over the vault. Returns notes most related in meaning to the query, not keyword matches. Use when the user asks to find something and you do not know exactly where it lives. Use include_paths/scope to restrict to a project subtree and min_score to raise the relevance floor.',
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
      },
      include_paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Vault-relative path prefixes to restrict results to (scope). Empty = whole vault.',
        default: []
      },
      scope: {
        type: 'string',
        description: 'Convenience alias for a single include_paths prefix (e.g. a project\'s vault-relative path).'
      },
      min_score: {
        type: 'number',
        description: 'Minimum similarity score (0–1) a result must meet, enforced server-side. Default ~0.5 for explicit search.',
        default: DEFAULT_MIN_SCORE
      }
    },
    required: ['query']
  },
  handler
};

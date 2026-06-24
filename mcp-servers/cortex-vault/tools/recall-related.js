'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getVaultPath } = require('../lib/vault-path.js');
const { openDb, indexFreshness } = require('../lib/search-db.js');
const { embedWithTimeout, MAX_CHARS } = require('../lib/embeddings.js');
const {
  parseFrontmatter,
  projectSegment,
  buildScopeMatcher,
  indexVault
} = require('../lib/indexer.js');

// Self-heal opt-out. On hookless surfaces (e.g. Cowork, where the post-tool-use
// re-embed hook never fires) the index would otherwise drift; strict users who
// want zero implicit work can disable the auto-reindex with this env var.
function autoReindexDisabled() {
  const v = process.env.CORTEX_NO_AUTO_REINDEX;
  return v === '1' || v === 'true' || v === 'yes';
}

const STOPWORDS = new Set([
  'the','and','for','with','that','this','from','into','your','have','been','are','but',
  'not','you','our','was','were','had','has','its','their','they','them','about','just',
  'what','when','where','which','while','should','would','could','will','can','also',
  'than','then','over','under','into','onto','per','via','vs','per','like'
]);

// W2.3 — server-side relevance floor. The audit target was "~0.7", but with
// this model's scoring (score = 1 - distance/2) genuine matches on real notes
// cluster around cosine 0–0.3 → score 0.5–0.65, while near-orthogonal noise
// sits below ~0.45. A literal 0.7 floor would filter out true hits and make
// ambient recall return nothing, defeating the feature. 0.55 separates real
// matches from orthogonal noise server-side while preserving genuine recall
// (callers/skills can raise it via min_score; see FINDINGS T07 score math).
const DEFAULT_MIN_SCORE = 0.55;

// W2.1 — one-time-per-process "initializing semantic search" note, emitted only
// when the first embed of the process is slow enough that the user notices.
const INIT_NOTE_THRESHOLD_MS = 2000;
let initNoteShown = false;

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

// Accept include_paths from either `include_paths` or the `scope` alias (a
// single path or an array), so callers can pass scope=active project's path.
function resolveIncludePaths(args) {
  const out = [];
  if (Array.isArray(args.include_paths)) out.push(...args.include_paths);
  else if (typeof args.include_paths === 'string' && args.include_paths) out.push(args.include_paths);
  if (Array.isArray(args.scope)) out.push(...args.scope);
  else if (typeof args.scope === 'string' && args.scope) out.push(args.scope);
  return out;
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

  // W2.1 — bounded embed. On a slow cold start, return empty results + a log
  // rather than stalling the turn. Surface a one-time init note past ~2s.
  const truncated = context.length > MAX_CHARS ? context.slice(0, MAX_CHARS) : context;
  const embedResult = await embedWithTimeout(truncated);

  if (embedResult.timedOut || embedResult.error) {
    const reason = embedResult.timedOut
      ? `timed out after ${embedResult.elapsed_ms}ms`
      : embedResult.error.message;
    process.stderr.write(
      `[cortex-vault] recall_related: embedding ${reason} — returning empty results\n`
    );
    const note = embedResult.timedOut
      ? 'Semantic search is still initializing — try again in a moment.'
      : 'Semantic search is unavailable.';
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            { count: 0, results: [], embedding_unavailable: true, note },
            null,
            2
          )
        }
      ]
    };
  }

  let initNote = null;
  if (!initNoteShown && embedResult.elapsed_ms >= INIT_NOTE_THRESHOLD_MS) {
    initNoteShown = true;
    initNote = '(initializing semantic search)';
  }

  const vector = embedResult.vector;

  const db = openDb(vault);
  try {
    // W2.2 — empty-vs-no-match signal. An empty index means "never built",
    // which is a different message ("run /cortex-index") from a genuine
    // no-match. Surface it explicitly.
    const freshness = indexFreshness(vault, db);
    if (freshness.empty) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
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

    // Self-heal a stale index before querying. On hookless surfaces (Cowork,
    // iPad) the post-tool-use re-embed hook never fires, so the index drifts as
    // notes are edited. The freshness gate above is cheap (one stat of
    // _changelog.txt vs MAX(updated)); when it reports staleness we run the
    // INCREMENTAL indexer, which hash-skips unchanged notes and embeds only the
    // delta — so recall reflects recent edits without a manual /cortex-index.
    // Best-effort: a reindex failure must never break recall.
    let healed = false;
    if (freshness.stale && !autoReindexDisabled()) {
      try {
        await indexVault(vault);
        healed = true;
      } catch (e) {
        process.stderr.write(`[cortex-vault] auto-reindex skipped: ${e.message}\n`);
      }
    }

    // Fetch extra so scope/score/exclude filtering doesn't starve k.
    const fetchK = Math.min(50, k + exclude_paths.length + includePaths.length + 10);
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
      .filter((r) => inScope(r.path)) // W2.3 — server-side scope enforcement
      .map((r) => ({
        path: r.path,
        project: projectSegment(r.path), // W2.3 — attribution
        title: r.title,
        score: Number((1 - r.distance / 2).toFixed(4)),
        why: extractWhy(vault, r.path, r.title)
      }))
      .filter((r) => r.score >= minScore) // W2.3 — server-side min_score
      .slice(0, k);

    const payload = {
      count: results.length,
      results,
      min_score: minScore
    };
    if (includePaths.length > 0) payload.scope = includePaths;
    if (healed) {
      payload.index_refreshed = true;
    } else if (freshness.stale) {
      payload.index_stale = true;
      payload.note = 'Semantic index may be stale — run /cortex-index to refresh.';
    }
    if (initNote) payload.init_note = initNote;

    return {
      content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }]
    };
  } finally {
    db.close();
  }
}

module.exports = {
  name: 'recall_related',
  description:
    'Silently recall notes semantically related to the current working context. Call this proactively (not only when asked) at the start of a new task, when the user mentions a vendor/tool/pattern, or when hitting a blocker — so you can surface prior vault knowledge the user may have forgotten. Use exclude_paths to skip the file currently being edited. Use include_paths/scope to restrict recall to a project subtree (e.g. the active project\'s vault path) and min_score to raise the relevance floor.',
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
      },
      include_paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Vault-relative path prefixes to restrict results to (scope). Empty = whole vault. A result matches if its path equals or is under any prefix.',
        default: []
      },
      scope: {
        type: 'string',
        description: 'Convenience alias for a single include_paths prefix (e.g. the active project\'s vault-relative path). Combined with include_paths if both are given.'
      },
      min_score: {
        type: 'number',
        description: 'Minimum similarity score (0–1) a result must meet, enforced server-side. Defaults to a noise floor (~0.55) that filters near-orthogonal matches; raise toward 0.7+ for high-precision recall.',
        default: DEFAULT_MIN_SCORE
      }
    },
    required: ['context']
  },
  handler
};

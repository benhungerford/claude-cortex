'use strict';

const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const sqliteVec = require('sqlite-vec');

const VECTOR_DIM = 384;

function openDb(vaultPath) {
  const cortexDir = path.join(vaultPath, '.cortex');
  fs.mkdirSync(cortexDir, { recursive: true });

  const dbPath = path.join(cortexDir, 'search.db');
  const db = new Database(dbPath);
  // WAL keeps readers (search_vault, recall_related) from blocking on
  // concurrent writers (post-tool-use re-embed, reindex_vault). busy_timeout
  // covers the brief contention window between sqlite-vec writes.
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');
  sqliteVec.load(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      path TEXT UNIQUE NOT NULL,
      mtime INTEGER NOT NULL,
      hash TEXT NOT NULL,
      title TEXT,
      updated INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_notes USING vec0(
      embedding float[${VECTOR_DIM}]
    );
  `);

  return db;
}

// W2.2 — index freshness signals. These let callers distinguish an empty index
// ("never built — run /cortex-index") from a genuine no-match, and surface a
// staleness notice when the vault has changed more recently than the index.

// Count indexed notes. 0 ⇒ the index has never been built (or was cleared).
function indexCount(db) {
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM notes').get().n;
  } catch {
    return 0;
  }
}

// Most recent index write (ms epoch), or 0 if empty.
function indexMaxUpdated(db) {
  try {
    const row = db.prepare('SELECT MAX(updated) AS m FROM notes').get();
    return row && row.m ? Number(row.m) : 0;
  } catch {
    return 0;
  }
}

// Compare the index's freshness against the vault's `_changelog.txt` mtime
// (a cheap proxy for "the vault changed"). Returns a small report the boot
// path / skill can turn into a one-line notice. Never throws.
function indexFreshness(vaultPath, db) {
  const count = indexCount(db);
  const empty = count === 0;
  const indexUpdated = indexMaxUpdated(db);

  let vaultChanged = 0;
  try {
    const changelog = path.join(vaultPath, '_changelog.txt');
    vaultChanged = fs.statSync(changelog).mtimeMs;
  } catch {
    vaultChanged = 0;
  }

  // Stale only when we have both signals and the vault moved after the index.
  const stale = !empty && vaultChanged > 0 && vaultChanged > indexUpdated;
  const ageMs = indexUpdated > 0 ? Math.max(0, vaultChanged - indexUpdated) : 0;

  return {
    count,
    empty,
    stale,
    index_updated: indexUpdated,
    vault_changed: vaultChanged,
    stale_by_ms: stale ? ageMs : 0
  };
}

module.exports = {
  openDb,
  VECTOR_DIM,
  indexCount,
  indexMaxUpdated,
  indexFreshness
};

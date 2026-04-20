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

module.exports = { openDb, VECTOR_DIM };

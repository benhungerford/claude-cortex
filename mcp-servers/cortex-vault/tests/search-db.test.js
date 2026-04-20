'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { openDb, VECTOR_DIM } = require('../lib/search-db.js');

function makeTmpVault() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-vault-test-'));
}

function rmDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('search-db', () => {
  let tmp;
  let db;

  beforeEach(() => {
    tmp = makeTmpVault();
  });

  afterEach(() => {
    if (db) {
      db.close();
      db = null;
    }
    rmDir(tmp);
  });

  test('creates .cortex directory and search.db file', () => {
    db = openDb(tmp);
    assert.equal(fs.existsSync(path.join(tmp, '.cortex')), true);
    assert.equal(fs.existsSync(path.join(tmp, '.cortex', 'search.db')), true);
  });

  test('creates notes and vec_notes tables', () => {
    db = openDb(tmp);

    const notesTable = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notes'")
      .get();
    assert.ok(notesTable, 'notes table should exist');

    const vecTable = db
      .prepare("SELECT name FROM sqlite_master WHERE name='vec_notes'")
      .get();
    assert.ok(vecTable, 'vec_notes virtual table should exist');
  });

  test('can insert and read back a note row', () => {
    db = openDb(tmp);
    const now = Date.now();
    db.prepare(
      'INSERT INTO notes(path, mtime, hash, title, updated) VALUES (?, ?, ?, ?, ?)'
    ).run('Work/note.md', now, 'deadbeef', 'Note Title', now);

    const row = db
      .prepare('SELECT path, hash, title FROM notes WHERE path=?')
      .get('Work/note.md');
    assert.equal(row.path, 'Work/note.md');
    assert.equal(row.hash, 'deadbeef');
    assert.equal(row.title, 'Note Title');
  });

  test('can insert and KNN-query vec_notes by rowid', () => {
    db = openDb(tmp);

    const zeros = new Float32Array(VECTOR_DIM);
    const ones = new Float32Array(VECTOR_DIM).fill(1 / Math.sqrt(VECTOR_DIM));

    const insert = db.prepare(
      'INSERT INTO vec_notes(rowid, embedding) VALUES (?, ?)'
    );
    insert.run(1n, zeros);
    insert.run(2n, ones);

    const results = db
      .prepare(
        `SELECT rowid, distance FROM vec_notes
         WHERE embedding MATCH ? AND k = 2
         ORDER BY distance`
      )
      .all(ones);

    assert.equal(results.length, 2);
    assert.equal(Number(results[0].rowid), 2, 'closest match should be the "ones" vector');
  });

  test('re-opening an existing DB does not duplicate or error', () => {
    db = openDb(tmp);
    db.prepare(
      'INSERT INTO notes(path, mtime, hash, title, updated) VALUES (?, ?, ?, ?, ?)'
    ).run('a.md', 1, 'h', 'A', 1);
    db.close();

    db = openDb(tmp);
    const row = db.prepare('SELECT path FROM notes WHERE path=?').get('a.md');
    assert.equal(row.path, 'a.md');
  });

  test('VECTOR_DIM is 384 (MiniLM)', () => {
    assert.equal(VECTOR_DIM, 384);
  });
});

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { openDb } = require('./search-db.js');
const { embed } = require('./embeddings.js');

const EXCLUDED_DIRS = new Set(['_Templates', 'Archives', '.cortex', 'node_modules']);

function isExcludedPath(relPath) {
  const parts = relPath.split(path.sep);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith('.')) return true; // hidden dirs/files
    if (EXCLUDED_DIRS.has(p)) return true;
  }
  return false;
}

function walk(rootDir, relDir = '') {
  const out = [];
  const full = path.join(rootDir, relDir);
  let entries;
  try {
    entries = fs.readdirSync(full, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = relDir ? path.join(relDir, e.name) : e.name;
    if (isExcludedPath(rel)) continue;
    if (e.isDirectory()) {
      out.push(...walk(rootDir, rel));
    } else if (e.isFile() && e.name.endsWith('.md')) {
      out.push(rel);
    }
  }
  return out;
}

function hashContent(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function parseFrontmatter(text) {
  if (!text.startsWith('---')) return { frontmatter: null, body: text };
  const end = text.indexOf('\n---', 3);
  if (end === -1) return { frontmatter: null, body: text };
  const frontmatter = text.slice(3, end).trim();
  const body = text.slice(end + 4).replace(/^\r?\n/, '');
  return { frontmatter, body };
}

function extractTitle(frontmatter, body, filePath) {
  if (frontmatter) {
    const m = frontmatter.match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (m) return m[1].trim();
  }
  const h1 = body.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return path.basename(filePath, '.md');
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

async function upsertNote(db, vaultPath, relPath, stat, content) {
  const { frontmatter, body } = parseFrontmatter(content);
  const title = extractTitle(frontmatter, body, relPath);
  const hash = hashContent(content);

  const existing = db
    .prepare('SELECT id, hash FROM notes WHERE path=?')
    .get(toPosix(relPath));

  if (existing && existing.hash === hash) {
    return 'skipped';
  }

  const embedInput = body.trim().length > 0 ? body : title;
  const vector = await embed(embedInput);

  const now = Date.now();
  let id;
  if (existing) {
    db.prepare(
      'UPDATE notes SET mtime=?, hash=?, title=?, updated=? WHERE id=?'
    ).run(stat.mtimeMs, hash, title, now, existing.id);
    id = existing.id;
    db.prepare('DELETE FROM vec_notes WHERE rowid=?').run(BigInt(id));
  } else {
    const info = db
      .prepare(
        'INSERT INTO notes(path, mtime, hash, title, updated) VALUES (?, ?, ?, ?, ?)'
      )
      .run(toPosix(relPath), stat.mtimeMs, hash, title, now);
    id = Number(info.lastInsertRowid);
  }

  db.prepare('INSERT INTO vec_notes(rowid, embedding) VALUES (?, ?)').run(
    BigInt(id),
    vector
  );

  return 'indexed';
}

async function indexVault(vaultPath, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const start = Date.now();
  const db = openDb(vaultPath);

  try {
    const files = walk(vaultPath);
    const seen = new Set();
    let indexed = 0;
    let skipped = 0;

    for (const relPath of files) {
      const abs = path.join(vaultPath, relPath);
      let stat;
      try {
        stat = fs.statSync(abs);
      } catch {
        continue;
      }
      const content = fs.readFileSync(abs, 'utf8');
      const status = await upsertNote(db, vaultPath, relPath, stat, content);
      if (status === 'indexed') indexed++;
      else skipped++;
      seen.add(toPosix(relPath));
      onProgress({ file: relPath, status });
    }

    // Remove rows for files that no longer exist
    const allPaths = db.prepare('SELECT id, path FROM notes').all();
    let removed = 0;
    const delNote = db.prepare('DELETE FROM notes WHERE id=?');
    const delVec = db.prepare('DELETE FROM vec_notes WHERE rowid=?');
    for (const row of allPaths) {
      if (!seen.has(row.path)) {
        delVec.run(BigInt(row.id));
        delNote.run(row.id);
        removed++;
      }
    }

    return { indexed, skipped, removed, elapsed_ms: Date.now() - start };
  } finally {
    db.close();
  }
}

async function indexOne(vaultPath, relPath) {
  const normalized = toPosix(relPath);
  if (isExcludedPath(normalized)) {
    return { status: 'skipped-excluded', path: normalized };
  }
  if (!normalized.endsWith('.md')) {
    return { status: 'skipped-not-markdown', path: normalized };
  }

  const db = openDb(vaultPath);
  try {
    const abs = path.join(vaultPath, normalized);
    if (!fs.existsSync(abs)) {
      const row = db.prepare('SELECT id FROM notes WHERE path=?').get(normalized);
      if (row) {
        db.prepare('DELETE FROM vec_notes WHERE rowid=?').run(BigInt(row.id));
        db.prepare('DELETE FROM notes WHERE id=?').run(row.id);
        return { status: 'removed', path: normalized };
      }
      return { status: 'missing', path: normalized };
    }
    const stat = fs.statSync(abs);
    const content = fs.readFileSync(abs, 'utf8');
    const status = await upsertNote(db, vaultPath, normalized, stat, content);
    return { status, path: normalized };
  } finally {
    db.close();
  }
}

module.exports = { indexVault, indexOne, isExcludedPath, parseFrontmatter, extractTitle };

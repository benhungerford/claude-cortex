const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = filePath + '.tmp.' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Raised when a guarded write (updateFileAtomic) detects that the file changed
 * between the transform reading it and the commit, and retries are exhausted.
 */
class ConcurrencyError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

// Hash file contents (or the absence of a file) so we can detect a mid-write
// change. A missing file hashes to a sentinel distinct from any real content.
function contentSignature(content) {
  if (content === null) return 'absent';
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}

// Per-file advisory lock via an exclusively-created lockfile (O_EXCL). This
// serializes writers *within and across* processes on the same filesystem.
// The lock is best-effort and self-healing: a stale lock older than
// LOCK_STALE_MS is reclaimed so a crashed writer cannot wedge a hub forever.
const LOCK_STALE_MS = 30000;
const LOCK_RETRY_MS = 15;
const LOCK_MAX_WAIT_MS = 5000;

function acquireLock(filePath) {
  const lockPath = filePath + '.lock';
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;
  ensureDir(path.dirname(filePath));
  // Busy-wait with a synchronous sleep — the critical section is tiny (one
  // read + one atomic rename), so contention windows are sub-millisecond.
  for (;;) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return lockPath;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Reclaim a stale lock left by a crashed writer.
      try {
        const stat = fs.statSync(lockPath);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          fs.rmSync(lockPath, { force: true });
          continue;
        }
      } catch {
        // Lock vanished between EEXIST and stat — retry immediately.
        continue;
      }
      if (Date.now() > deadline) {
        throw new ConcurrencyError(
          `Timed out acquiring lock for ${filePath} after ${LOCK_MAX_WAIT_MS}ms`
        );
      }
      sleepSync(LOCK_RETRY_MS);
    }
  }
}

function releaseLock(lockPath) {
  try {
    fs.rmSync(lockPath, { force: true });
  } catch {
    /* best-effort */
  }
}

// Synchronous sleep without spinning the CPU hard, using a blocking fs op.
function sleepSync(ms) {
  // Atomics.wait on a throwaway buffer blocks the thread for `ms` without busy
  // spinning and without async scheduling.
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

/**
 * Read-modify-write a file with concurrency protection. Keeps the atomic
 * tmp+rename primitive (via writeFile) and layers two guards on top:
 *
 *  1. A per-file advisory lock (lockfile) serializes writers.
 *  2. Optimistic CAS: the content is hashed at read time and re-read just
 *     before commit; if it changed underneath us, the write aborts.
 *
 * @param {string} filePath
 * @param {(current: string|null) => string|null|undefined} transformFn
 *        Receives current content (null if the file does not exist). Return the
 *        new content to write, or null/undefined to abort the write (no-op).
 * @param {{ retries?: number }} [opts]
 *        retries: on a detected mid-transform conflict, re-run the transform
 *        against the latest content up to this many additional times before
 *        throwing ConcurrencyError. Default 0 (abort on first conflict).
 * @returns {{ written: boolean, content: string|null }}
 * @throws {ConcurrencyError} when a conflict is detected and retries are exhausted.
 */
function updateFileAtomic(filePath, transformFn, opts = {}) {
  const retries = Number.isInteger(opts.retries) && opts.retries > 0 ? opts.retries : 0;
  const lockPath = acquireLock(filePath);
  try {
    let attempt = 0;
    for (;;) {
      const before = readFile(filePath);
      const beforeSig = contentSignature(before);

      const next = transformFn(before);

      // Abort signal from the transform.
      if (next === null || next === undefined) {
        return { written: false, content: before };
      }

      // CAS: re-read and verify nothing changed while the transform ran.
      const afterSig = contentSignature(readFile(filePath));
      if (afterSig !== beforeSig) {
        if (attempt < retries) {
          attempt++;
          continue; // re-run transform against fresh content
        }
        throw new ConcurrencyError(
          `${filePath} changed during update (concurrent writer); aborted after ${attempt + 1} attempt(s)`
        );
      }

      writeFile(filePath, next);
      return { written: true, content: next };
    }
  } finally {
    releaseLock(lockPath);
  }
}

function appendFile(filePath, line) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const suffix = line.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(filePath, line + suffix, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

module.exports = {
  readFile,
  writeFile,
  appendFile,
  ensureDir,
  fileExists,
  updateFileAtomic,
  ConcurrencyError
};

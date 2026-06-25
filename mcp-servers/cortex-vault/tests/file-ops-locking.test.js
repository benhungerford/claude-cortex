'use strict';

// W3.7 (T16): concurrency protection around hub read-modify-write.
// Tests prove updateFileAtomic guards against lost writes via a per-file
// advisory lock and aborts on a detected mid-write change (optimistic CAS).
// Uses real fs in a tmp dir. The existing readFile/writeFile primitives must
// keep working unchanged (covered by lib.test.js).

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const {
  readFile,
  writeFile,
  updateFileAtomic,
  ConcurrencyError
} = require('../lib/file-ops.js');

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-fileops-lock-'));
}
function rmTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('file-ops concurrency guard (W3.7)', () => {
  let tmpDir;
  beforeEach(() => { tmpDir = makeTmpDir(); });
  afterEach(() => { rmTmpDir(tmpDir); });

  test('updateFileAtomic applies a transform to an existing file', () => {
    const fp = path.join(tmpDir, 'hub.md');
    writeFile(fp, 'count: 0\n');
    updateFileAtomic(fp, (cur) => cur.replace('count: 0', 'count: 1'));
    assert.equal(readFile(fp), 'count: 1\n');
  });

  test('updateFileAtomic passes null to transform for a missing file (create case)', () => {
    const fp = path.join(tmpDir, 'new-hub.md');
    updateFileAtomic(fp, (cur) => {
      assert.equal(cur, null, 'transform should receive null when file is absent');
      return 'fresh content\n';
    });
    assert.equal(readFile(fp), 'fresh content\n');
  });

  test('returning null/undefined from the transform aborts the write (no-op)', () => {
    const fp = path.join(tmpDir, 'hub.md');
    writeFile(fp, 'original\n');
    const ret = updateFileAtomic(fp, () => null);
    assert.equal(readFile(fp), 'original\n', 'file must be untouched on null transform');
    assert.equal(ret.written, false);
  });

  // Lost-write protection: many sequential read-modify-write appends through
  // updateFileAtomic must not lose any write. Because each call re-reads inside
  // the lock, every increment is preserved.
  test('sequential read-modify-write appends do not lose a write', () => {
    const fp = path.join(tmpDir, 'log.md');
    writeFile(fp, '');
    const N = 50;
    for (let i = 0; i < N; i++) {
      updateFileAtomic(fp, (cur) => (cur || '') + `line ${i}\n`);
    }
    const lines = readFile(fp).trim().split('\n');
    assert.equal(lines.length, N, 'all N writes preserved');
    for (let i = 0; i < N; i++) {
      assert.equal(lines[i], `line ${i}`);
    }
  });

  // Optimistic CAS: if the file changes between the transform reading it and the
  // commit, updateFileAtomic must detect the mid-write change and abort with a
  // ConcurrencyError rather than clobbering the other writer's content.
  test('aborts with ConcurrencyError when the file changes mid-transform', () => {
    const fp = path.join(tmpDir, 'hub.md');
    writeFile(fp, 'v1\n');

    assert.throws(
      () => {
        updateFileAtomic(fp, (cur) => {
          assert.equal(cur, 'v1\n');
          // Simulate another writer committing between read and write.
          fs.writeFileSync(fp, 'v2-from-other-writer\n', 'utf8');
          return 'v1-modified\n';
        });
      },
      (err) => err instanceof ConcurrencyError,
      'should throw ConcurrencyError on detected mid-write change'
    );

    // The other writer's content must survive — our write was aborted.
    assert.equal(readFile(fp), 'v2-from-other-writer\n');
  });

  // The retry path: updateFileAtomic with { retries } should re-run the transform
  // against the latest content after a detected conflict and ultimately succeed.
  test('retries the transform against fresh content after a conflict', () => {
    const fp = path.join(tmpDir, 'hub.md');
    writeFile(fp, 'base=0\n');

    let attempt = 0;
    const result = updateFileAtomic(fp, (cur) => {
      attempt++;
      if (attempt === 1) {
        // First pass: a concurrent writer changes the file before we commit.
        fs.writeFileSync(fp, 'base=99\n', 'utf8');
        return 'should-be-discarded\n';
      }
      // Second pass: cur reflects the concurrent writer's value.
      assert.equal(cur, 'base=99\n', 'retry should re-read fresh content');
      return cur.replace('base=99', 'base=100');
    }, { retries: 3 });

    assert.equal(attempt, 2, 'transform should run twice');
    assert.equal(result.written, true);
    assert.equal(readFile(fp), 'base=100\n');
  });
});

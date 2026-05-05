'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  VALID_ACTIONS,
  formatTimestamp,
  formatChangelogEntry
} = require('../lib/changelog-format.js');

describe('changelog-format', () => {
  test('formatTimestamp pads single-digit fields', () => {
    const d = new Date(2026, 0, 5, 3, 7); // Jan 5 2026 03:07 local
    assert.equal(formatTimestamp(d), '2026-01-05 03:07');
  });

  test('formatChangelogEntry produces expected line shape', () => {
    const ts = new Date(2026, 4, 5, 10, 30); // May 5 2026 10:30
    const entry = formatChangelogEntry({
      action: 'CREATED',
      file: 'foo.md',
      dest: 'Work/Foo/',
      note: 'made a thing',
      timestamp: ts
    });
    assert.equal(entry, '[2026-05-05 10:30] CREATED | FILE: foo.md | DEST: Work/Foo/ | NOTE: made a thing');
  });

  test('automated tag inserts [auto]', () => {
    const ts = new Date(2026, 4, 5, 10, 30);
    const entry = formatChangelogEntry({
      action: 'UPDATED',
      file: 'x.md',
      dest: 'Work/',
      note: 'auto note',
      automated: true,
      timestamp: ts
    });
    assert.match(entry, /UPDATED \[auto\] \|/);
  });

  test('throws on invalid action', () => {
    assert.throws(
      () => formatChangelogEntry({ action: 'BOGUS', file: 'x', dest: 'y/', note: 'z' }),
      /Invalid changelog action/
    );
  });

  test('VALID_ACTIONS includes new INDEX_FAILED action', () => {
    assert.ok(VALID_ACTIONS.includes('INDEX_FAILED'));
  });
});

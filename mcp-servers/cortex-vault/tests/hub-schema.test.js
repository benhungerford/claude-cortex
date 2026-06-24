'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  parseQuestionBlockerRows,
  classifyRows,
  emptyTable,
  addRow,
  resolveRow,
  migrateBodyToCanonical,
  HUB_SECTION,
} = require('../lib/hub-schema.js');

const TABLE = `## Open Questions & Blockers
| # | Question / Blocker | Type | Owner | Status |
|---|-------------------|------|-------|--------|
| 1 | Which payment provider? | Question | Client | Open |
| 2 | Stripe sandbox credentials | Dependency | Client | Open |
| 3 | Database choice | Internal | Ben | Resolved |
`;

describe('hub-schema parse', () => {
  test('parses pipe-table rows into structured objects', () => {
    const rows = parseQuestionBlockerRows(TABLE);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows[0], { num: '1', question: 'Which payment provider?', type: 'Question', owner: 'Client', status: 'Open' });
    assert.equal(rows[1].type, 'Dependency');
    assert.equal(rows[2].status, 'Resolved');
  });

  test('ignores the placeholder blank row', () => {
    const rows = parseQuestionBlockerRows(emptyTable());
    assert.equal(rows.length, 0);
  });

  test('classifyRows splits blockers vs questions and skips resolved', () => {
    const rows = parseQuestionBlockerRows(TABLE);
    const { openQuestions, blockers } = classifyRows(rows);
    // Dependency/Internal/Unknown => blocker; resolved skipped
    assert.deepEqual(openQuestions, ['Which payment provider?']);
    assert.deepEqual(blockers, ['Stripe sandbox credentials']);
  });
});

describe('hub-schema addRow', () => {
  test('appends an auto-numbered Open row to the table', () => {
    const out = addRow(TABLE, { question: 'New thing', type: 'Question', owner: 'Ben' });
    const rows = parseQuestionBlockerRows(out);
    assert.equal(rows.length, 4);
    assert.equal(rows[3].num, '4');
    assert.equal(rows[3].question, 'New thing');
    assert.equal(rows[3].status, 'Open');
  });

  test('creates the section + table when missing', () => {
    const body = '# Some Hub\n\n## Overview\n\nstuff\n\n---\n*Related:* [[_MOC]]\n';
    const out = addRow(body, { question: 'First q' });
    assert.ok(out.includes(HUB_SECTION));
    const rows = parseQuestionBlockerRows(out);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].question, 'First q');
  });
});

describe('hub-schema resolveRow', () => {
  test('removes the matched row entirely (no strikethrough)', () => {
    const res = resolveRow(TABLE, 'payment provider');
    assert.equal(res.error, undefined);
    assert.equal(res.removed, 'Which payment provider?');
    const rows = parseQuestionBlockerRows(res.content);
    assert.equal(rows.length, 2);
    assert.ok(!res.content.includes('Which payment provider?'));
    assert.ok(!res.content.includes('[x]'));
  });

  test('returns error with candidates on ambiguous match', () => {
    const res = resolveRow(TABLE, 'a'); // matches multiple
    assert.ok(res.error);
    assert.ok(Array.isArray(res.candidates));
    assert.ok(res.candidates.length >= 2);
  });

  test('returns notFound when no row matches', () => {
    const res = resolveRow(TABLE, 'zzz-nonexistent');
    assert.equal(res.notFound, true);
  });
});

describe('hub-schema migrateBodyToCanonical', () => {
  const LEGACY = `# Old Hub

## Overview

stuff

## Open Questions

- [ ] Which payment provider?
- [x] Database choice — Resolved: PostgreSQL

## Key Decisions

- Node backend

## Blockers

- [ ] Stripe sandbox credentials

---
*Related:* [[_MOC]]
`;

  test('converts legacy checkbox sections into the canonical pipe-table', () => {
    const { body, changed } = migrateBodyToCanonical(LEGACY);
    assert.equal(changed, true);
    assert.ok(body.includes(HUB_SECTION), 'has canonical section');
    assert.ok(!/## Open Questions\b(?! &)/.test(body), 'old Open Questions section removed');
    assert.ok(!body.includes('## Blockers'), 'old Blockers section removed');
    assert.ok(!body.includes('- [ ]') && !body.includes('- [x]'), 'no checkbox items remain');

    const { openQuestions, blockers } = classifyRows(parseQuestionBlockerRows(body));
    assert.deepEqual(openQuestions, ['Which payment provider?']);
    assert.deepEqual(blockers, ['Stripe sandbox credentials']);
    // Resolved item preserved as a Resolved row (not counted, but retained)
    const rows = parseQuestionBlockerRows(body);
    assert.ok(rows.some((r) => r.question === 'Database choice' && r.status === 'Resolved'));
    // Key Decisions section untouched
    assert.ok(body.includes('## Key Decisions'));
  });

  test('is idempotent on an already-canonical hub', () => {
    const canonical = migrateBodyToCanonical(LEGACY).body;
    const again = migrateBodyToCanonical(canonical);
    assert.equal(again.changed, false);
    assert.equal(again.body, canonical);
  });
});

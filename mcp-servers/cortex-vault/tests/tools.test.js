'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function copyFixtureVault() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-tools-'));
  const fixtureDir = path.join(__dirname, 'fixtures', 'vault');
  fs.cpSync(fixtureDir, tmpDir, { recursive: true });
  return tmpDir;
}

function rmTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// append_changelog
// ---------------------------------------------------------------------------

describe('append_changelog', () => {
  const tool = require('../tools/append-changelog.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('has correct inputSchema with action enum', () => {
    const enumValues = tool.inputSchema.properties.action.enum;
    assert.ok(Array.isArray(enumValues), 'action should have enum');
    assert.ok(enumValues.includes('CREATED'), 'enum should include CREATED');
    assert.ok(enumValues.includes('STATUS_CHANGED'), 'enum should include STATUS_CHANGED');
    assert.ok(enumValues.includes('MOC_UPDATED'), 'enum should include MOC_UPDATED');
  });

  test('appends correctly formatted entry to _changelog.txt', async () => {
    const result = await tool.handler(
      { action: 'CREATED', file: 'Test.md', dest: 'Work/TBL/Test/', note: 'Test note' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');
    const entry = result.content[0].text;

    // Check timestamp pattern [YYYY-MM-DD HH:MM]
    assert.match(entry, /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]/);
    assert.ok(entry.includes('CREATED'), 'entry should include action');
    assert.ok(entry.includes('FILE: Test.md'), 'entry should include file');
    assert.ok(entry.includes('DEST: Work/TBL/Test/'), 'entry should include dest');
    assert.ok(entry.includes('NOTE: Test note'), 'entry should include note');

    // Verify it was actually appended to the file
    const changelogPath = path.join(tmpVault, '_changelog.txt');
    const contents = fs.readFileSync(changelogPath, 'utf8');
    assert.ok(contents.includes('FILE: Test.md'), 'changelog file should contain new entry');
  });

  test('rejects invalid action types', async () => {
    const result = await tool.handler(
      { action: 'INVALID_ACTION', file: 'Test.md', dest: 'Work/', note: 'note' },
      tmpVault
    );

    assert.equal(result.isError, true, 'should be an error');
    assert.ok(result.content[0].text.includes('Invalid action'), 'error should mention invalid action');
  });
});

// ---------------------------------------------------------------------------
// update_moc
// ---------------------------------------------------------------------------

describe('update_moc', () => {
  const tool = require('../tools/update-moc.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('adds entry to end of MOC when no section specified', async () => {
    const mocRelPath = 'Work/TBL/Test Client/Test Project/_MOC.md';
    const result = await tool.handler(
      { moc_path: mocRelPath, entry_title: 'New Note' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const contents = fs.readFileSync(path.join(tmpVault, mocRelPath), 'utf8');
    assert.ok(contents.includes('- [[New Note]]'), 'MOC should contain new entry');
  });

  test('adds entry under a specific section heading', async () => {
    const mocRelPath = 'Work/TBL/Test Client/Test Project/_MOC.md';
    const result = await tool.handler(
      { moc_path: mocRelPath, entry_title: '2026-03-22 Sprint Review', section: 'Notes' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const contents = fs.readFileSync(path.join(tmpVault, mocRelPath), 'utf8');
    assert.ok(contents.includes('- [[2026-03-22 Sprint Review]]'), 'MOC should contain new entry');

    // Entry should appear after the ## Notes heading
    const notesIdx = contents.indexOf('## Notes');
    const entryIdx = contents.indexOf('- [[2026-03-22 Sprint Review]]');
    assert.ok(notesIdx !== -1 && entryIdx > notesIdx, 'entry should be under ## Notes section');
  });

  test('bumps updated in frontmatter', async () => {
    const mocRelPath = 'Work/TBL/Test Client/Test Project/_MOC.md';
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    await tool.handler(
      { moc_path: mocRelPath, entry_title: 'Another Note' },
      tmpVault
    );

    const contents = fs.readFileSync(path.join(tmpVault, mocRelPath), 'utf8');
    assert.ok(contents.includes(todayStr), 'updated date should be bumped to today');
  });
});

// ---------------------------------------------------------------------------
// read_hub
// ---------------------------------------------------------------------------

describe('read_hub', () => {
  const tool = require('../tools/read-hub.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('returns structured project data', async () => {
    const result = await tool.handler(
      { project_path: 'Work/TBL/Test Client/Test Project' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const data = JSON.parse(result.content[0].text);
    assert.equal(data.project, 'Test Project');
    assert.equal(data.client, 'Test Client');
    assert.equal(data.status, 'Active Build');
    assert.ok(Array.isArray(data.open_questions), 'open_questions should be an array');
    assert.equal(data.open_questions.length, 2, 'should have 2 unchecked open questions');
    assert.ok(data.open_questions.some(q => q.includes('API integration')), 'should include API question');
    assert.ok(data.open_questions.some(q => q.includes('payment provider')), 'should include payment question');
  });

  test('returns error for nonexistent project path', async () => {
    const result = await tool.handler(
      { project_path: 'Work/TBL/Nonexistent Client/Nonexistent Project' },
      tmpVault
    );

    assert.equal(result.isError, true, 'should be an error');
    assert.ok(result.content[0].text.length > 0, 'error message should not be empty');
  });
});

// ---------------------------------------------------------------------------
// find_project_by_cwd
// ---------------------------------------------------------------------------

describe('find_project_by_cwd', () => {
  const tool = require('../tools/find-project-by-cwd.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('finds registered project by exact path', async () => {
    const result = await tool.handler(
      { cwd: '/Users/test/code/test-project' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');
    const data = JSON.parse(result.content[0].text);
    assert.ok(data !== null, 'should find a match');
    assert.equal(data.project, 'Test Project');
    assert.equal(data.client, 'Test Client');
    assert.equal(data.vault_path, 'Work/TBL/Test Client/Test Project');
  });

  test('finds project from a subdirectory', async () => {
    const result = await tool.handler(
      { cwd: '/Users/test/code/test-project/src/components' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');
    const data = JSON.parse(result.content[0].text);
    assert.ok(data !== null, 'should find a match by walking up');
    assert.equal(data.project, 'Test Project');
  });

  test('returns null for unregistered path', async () => {
    const result = await tool.handler(
      { cwd: '/Users/test/code/completely-different-repo' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');
    const data = JSON.parse(result.content[0].text);
    assert.equal(data, null, 'should return null for unregistered path');
  });
});

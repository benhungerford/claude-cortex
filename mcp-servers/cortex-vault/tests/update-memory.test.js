'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const tool = require('../tools/update-memory.js');

// ---------------------------------------------------------------------------
// Helper — same fixture-vault pattern as tools.test.js
// ---------------------------------------------------------------------------

function copyFixtureVault() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-update-memory-'));
  const fixtureDir = path.join(__dirname, 'fixtures', 'vault');
  fs.cpSync(fixtureDir, tmpDir, { recursive: true });
  return tmpDir;
}

function rmTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function readMemory(vault) {
  return fs.readFileSync(path.join(vault, 'memory.md'), 'utf8');
}

describe('update_memory: module shape', () => {
  test('exports a standard tool module', () => {
    assert.equal(tool.name, 'update_memory');
    assert.equal(typeof tool.description, 'string');
    assert.ok(tool.description.length > 0);
    assert.equal(typeof tool.handler, 'function');
    assert.equal(tool.inputSchema.type, 'object');
    assert.ok(tool.inputSchema.properties.content, 'has content property');
    assert.ok(tool.inputSchema.properties.section, 'has section property');
    assert.deepEqual(tool.inputSchema.required, ['content']);
  });
});

describe('update_memory: basic append', () => {
  let vault;
  beforeEach(() => { vault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(vault); });

  test('appends a fact to memory.md', async () => {
    const result = await tool.handler({ content: 'Client prefers Tailwind over Bootstrap.' }, vault);
    assert.equal(result.isError, undefined, 'should not be an error');
    assert.ok(readMemory(vault).includes('Client prefers Tailwind over Bootstrap.'));
  });

  test('errors when content is empty', async () => {
    const result = await tool.handler({ content: '   ' }, vault);
    assert.equal(result.isError, true);
    assert.match(result.content[0].text.toLowerCase(), /content/);
  });

  test('errors when no vault is configured', async () => {
    // No vaultOverride and no real config in this sandbox path → getVaultPath
    // may still resolve from the user's machine, so we assert via an explicit
    // empty override instead.
    const result = await tool.handler({ content: 'x' }, '');
    assert.equal(result.isError, true);
    assert.match(result.content[0].text.toLowerCase(), /vault/);
  });
});

describe('update_memory: dedup', () => {
  let vault;
  beforeEach(() => { vault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(vault); });

  test('does not append a verbatim duplicate line', async () => {
    await tool.handler({ content: 'Deploys happen on Fridays.' }, vault);
    const result = await tool.handler({ content: 'Deploys happen on Fridays.' }, vault);
    const occurrences = readMemory(vault).split('Deploys happen on Fridays.').length - 1;
    assert.equal(occurrences, 1, 'duplicate line should be written only once');
    assert.match(result.content[0].text.toLowerCase(), /duplicate|already/);
  });

  test('dedup ignores surrounding whitespace differences', async () => {
    await tool.handler({ content: 'Same fact.' }, vault);
    await tool.handler({ content: '  Same fact.  ' }, vault);
    const occurrences = readMemory(vault).split('Same fact.').length - 1;
    assert.equal(occurrences, 1);
  });
});

describe('update_memory: section headers', () => {
  let vault;
  beforeEach(() => { vault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(vault); });

  test('creates a section header when section is new', async () => {
    await tool.handler({ content: 'Likes dark mode.', section: 'Client Preferences' }, vault);
    const mem = readMemory(vault);
    assert.ok(mem.includes('## Client Preferences'), 'should create section header');
    // fact should appear after its header
    const idxHeader = mem.indexOf('## Client Preferences');
    const idxFact = mem.indexOf('Likes dark mode.');
    assert.ok(idxFact > idxHeader, 'fact should be under its section');
  });

  test('reuses an existing section header rather than duplicating it', async () => {
    await tool.handler({ content: 'Fact A.', section: 'Client Preferences' }, vault);
    await tool.handler({ content: 'Fact B.', section: 'Client Preferences' }, vault);
    const mem = readMemory(vault);
    const headerCount = mem.split('## Client Preferences').length - 1;
    assert.equal(headerCount, 1, 'section header should appear once');
    assert.ok(mem.includes('Fact A.') && mem.includes('Fact B.'));
  });
});

describe('update_memory: eviction notice', () => {
  let vault;
  beforeEach(() => { vault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(vault); });

  test('emits an eviction notice once memory.md exceeds the soft cap', async () => {
    let lastResult;
    // Push well past the ~80-line soft cap with unique facts.
    for (let i = 0; i < 90; i++) {
      lastResult = await tool.handler({ content: `Fact number ${i} is unique.` }, vault);
    }
    const lineCount = readMemory(vault).split('\n').length;
    assert.ok(lineCount > 80, 'memory should have grown past the cap');
    assert.match(lastResult.content[0].text.toLowerCase(), /evict|cap|compact|line/);
  });

  test('stays quiet about eviction when well under the cap', async () => {
    const result = await tool.handler({ content: 'Just one small fact.' }, vault);
    assert.doesNotMatch(result.content[0].text.toLowerCase(), /evict/);
  });
});

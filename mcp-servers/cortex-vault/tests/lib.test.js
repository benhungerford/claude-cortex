'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-test-'));
}

function rmTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// ---------------------------------------------------------------------------
// vault-path tests
// ---------------------------------------------------------------------------

describe('vault-path', () => {
  let tmpHome;
  let originalHome;

  beforeEach(() => {
    tmpHome = makeTmpDir();
    originalHome = process.env.HOME;
    process.env.HOME = tmpHome;

    // Clear the module cache so the module re-reads process.env.HOME
    delete require.cache[require.resolve('../lib/vault-path.js')];
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    delete require.cache[require.resolve('../lib/vault-path.js')];
    rmTmpDir(tmpHome);
  });

  test('reads vault_path from config.json when directory exists', () => {
    // Create vault directory
    const vaultDir = path.join(tmpHome, 'my-vault');
    fs.mkdirSync(vaultDir, { recursive: true });

    // Write config
    const configDir = path.join(tmpHome, '.claude', 'cortex');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ vault_path: vaultDir }),
      'utf8'
    );

    const { getVaultPath } = require('../lib/vault-path.js');
    assert.equal(getVaultPath(), vaultDir);
  });

  test('returns null when config.json is missing', () => {
    // No config file created
    const { getVaultPath } = require('../lib/vault-path.js');
    assert.equal(getVaultPath(), null);
  });

  test('returns null when vault_path directory does not exist', () => {
    const configDir = path.join(tmpHome, '.claude', 'cortex');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ vault_path: path.join(tmpHome, 'nonexistent-vault') }),
      'utf8'
    );

    const { getVaultPath } = require('../lib/vault-path.js');
    assert.equal(getVaultPath(), null);
  });

  test('returns null when vault_path is a file, not a directory', () => {
    const filePath = path.join(tmpHome, 'not-a-dir.txt');
    fs.writeFileSync(filePath, 'hello', 'utf8');

    const configDir = path.join(tmpHome, '.claude', 'cortex');
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      path.join(configDir, 'config.json'),
      JSON.stringify({ vault_path: filePath }),
      'utf8'
    );

    const { getVaultPath } = require('../lib/vault-path.js');
    assert.equal(getVaultPath(), null);
  });

  test('caches the result on subsequent calls', () => {
    const vaultDir = path.join(tmpHome, 'cached-vault');
    fs.mkdirSync(vaultDir, { recursive: true });

    const configDir = path.join(tmpHome, '.claude', 'cortex');
    fs.mkdirSync(configDir, { recursive: true });
    const configFile = path.join(configDir, 'config.json');
    fs.writeFileSync(configFile, JSON.stringify({ vault_path: vaultDir }), 'utf8');

    const { getVaultPath, clearCache } = require('../lib/vault-path.js');

    const first = getVaultPath();
    assert.equal(first, vaultDir);

    // Delete the config — subsequent calls should still return cached value
    fs.unlinkSync(configFile);
    const second = getVaultPath();
    assert.equal(second, vaultDir, 'should return cached value even after config deleted');

    // After clearCache, re-read should return null
    clearCache();
    const third = getVaultPath();
    assert.equal(third, null);
  });
});

// ---------------------------------------------------------------------------
// yaml tests
// ---------------------------------------------------------------------------

describe('yaml', () => {
  const { parseYaml, stringifyYaml, extractFrontmatter, replaceFrontmatter } = require('../lib/yaml.js');

  test('quotes strings starting with # using double quotes in output', () => {
    const data = { tags: ['#type/meeting-notes', '#source/granola'] };
    const out = stringifyYaml(data);
    assert.ok(out.includes('"#type/meeting-notes"'), `Expected double-quoted tag, got:\n${out}`);
    assert.ok(out.includes('"#source/granola"'), `Expected double-quoted tag, got:\n${out}`);
  });

  test('quotes # key-value string values using double quotes', () => {
    const data = { type: '#type/project-context' };
    const out = stringifyYaml(data);
    assert.ok(out.includes('"#type/project-context"'), `Expected double-quoted value, got:\n${out}`);
  });

  test('roundtrips YAML data correctly', () => {
    const data = {
      project: 'Test Project',
      status: 'Active Build',
      tags: ['#type/project-context', '#domain/shopify'],
      launch: '2026-05-18',
    };
    const yamlStr = stringifyYaml(data);
    const parsed = parseYaml(yamlStr);

    assert.equal(parsed.project, data.project);
    assert.equal(parsed.status, data.status);
    assert.deepEqual(parsed.tags, data.tags);
    assert.equal(parsed.launch, data.launch);
  });

  test('extractFrontmatter splits --- delimited frontmatter from body', () => {
    const fileContent = [
      '---',
      'type: meeting-notes',
      'tags:',
      '  - "#type/meeting-notes"',
      '---',
      '',
      '# Meeting Title',
      '',
      'Body text here.',
    ].join('\n');

    const { frontmatter, body } = extractFrontmatter(fileContent);
    assert.ok(frontmatter !== null, 'frontmatter should not be null');
    assert.equal(frontmatter.type, 'meeting-notes');
    assert.deepEqual(frontmatter.tags, ['#type/meeting-notes']);
    assert.ok(body.includes('# Meeting Title'));
    assert.ok(body.includes('Body text here.'));
  });

  test('extractFrontmatter returns null frontmatter for files without it', () => {
    const fileContent = '# Just a Heading\n\nSome body content.';
    const { frontmatter, body } = extractFrontmatter(fileContent);
    assert.equal(frontmatter, null);
    assert.equal(body, fileContent);
  });

  test('extractFrontmatter returns null frontmatter for empty file', () => {
    const { frontmatter, body } = extractFrontmatter('');
    assert.equal(frontmatter, null);
    assert.equal(body, '');
  });

  test('replaceFrontmatter replaces frontmatter and preserves body', () => {
    const original = [
      '---',
      'type: old-type',
      'status: Planning',
      '---',
      '',
      '# My Note',
      '',
      'Some content.',
    ].join('\n');

    const newFm = { type: 'new-type', status: 'Active Build', tags: ['#type/project-context'] };
    const result = replaceFrontmatter(original, newFm);

    // New frontmatter present
    assert.ok(result.startsWith('---\n'), 'should start with ---');
    assert.ok(result.includes('new-type'), 'should include new type');
    assert.ok(result.includes('Active Build'), 'should include new status');
    assert.ok(result.includes('"#type/project-context"'), 'should double-quote # tag');

    // Old frontmatter gone
    assert.ok(!result.includes('old-type'), 'should not include old type');
    assert.ok(!result.includes('Planning'), 'should not include old status');

    // Body preserved
    assert.ok(result.includes('# My Note'), 'should preserve body heading');
    assert.ok(result.includes('Some content.'), 'should preserve body text');
  });

  test('replaceFrontmatter works when file has no existing frontmatter', () => {
    const noFm = '# Just a heading\n\nContent.';
    const result = replaceFrontmatter(noFm, { type: 'reference' });
    assert.ok(result.startsWith('---\n'));
    assert.ok(result.includes('type: reference'));
    assert.ok(result.includes('# Just a heading'));
  });

  test('never outputs unquoted # values (critical invariant)', () => {
    const data = {
      tags: [
        '#type/meeting-notes',
        '#source/granola',
        '#source/client',
        '#status/active',
        '#domain/shopify',
        '#client/fkt',
      ],
      type: '#type/project-context',
    };
    const out = stringifyYaml(data);

    // Every # value must be wrapped in double quotes
    // Check: no line has a bare # (not preceded by a quote char on the same line)
    const lines = out.split('\n');
    for (const line of lines) {
      // Skip comment lines and blank lines
      if (!line.trim() || line.trim().startsWith('#')) continue;

      // Find all # occurrences in the value portion
      const colonIdx = line.indexOf(':');
      const dashIdx = line.indexOf('- ');

      let valueStart = -1;
      if (colonIdx !== -1) valueStart = colonIdx + 1;
      else if (dashIdx !== -1) valueStart = dashIdx + 2;

      if (valueStart !== -1) {
        const valuePart = line.slice(valueStart).trim();
        if (valuePart.startsWith('#')) {
          // Must be wrapped in double quotes
          assert.ok(
            valuePart.startsWith('"#') && valuePart.endsWith('"'),
            `Unquoted # value found in line: ${JSON.stringify(line)}`
          );
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// file-ops tests
// ---------------------------------------------------------------------------

describe('file-ops', () => {
  const { readFile, writeFile, appendFile, ensureDir, fileExists } = require('../lib/file-ops.js');

  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    rmTmpDir(tmpDir);
  });

  test('writes and reads a file', () => {
    const filePath = path.join(tmpDir, 'hello.txt');
    writeFile(filePath, 'Hello, world!');
    const content = readFile(filePath);
    assert.equal(content, 'Hello, world!');
  });

  test('returns null for nonexistent file', () => {
    const result = readFile(path.join(tmpDir, 'does-not-exist.txt'));
    assert.equal(result, null);
  });

  test('writeFile overwrites existing content', () => {
    const filePath = path.join(tmpDir, 'overwrite.txt');
    writeFile(filePath, 'first');
    writeFile(filePath, 'second');
    assert.equal(readFile(filePath), 'second');
  });

  test('writeFile creates intermediate directories', () => {
    const filePath = path.join(tmpDir, 'nested', 'deep', 'file.txt');
    writeFile(filePath, 'deep content');
    assert.equal(readFile(filePath), 'deep content');
  });

  test('appendFile adds content with trailing newline', () => {
    const filePath = path.join(tmpDir, 'append.txt');
    writeFile(filePath, 'line1\n');
    appendFile(filePath, 'line2');
    const content = readFile(filePath);
    assert.equal(content, 'line1\nline2\n');
  });

  test('appendFile does not double-add newline when line already ends with one', () => {
    const filePath = path.join(tmpDir, 'append-nl.txt');
    writeFile(filePath, '');
    appendFile(filePath, 'line with newline\n');
    const content = readFile(filePath);
    assert.equal(content, 'line with newline\n');
  });

  test('appendFile creates file if it does not exist', () => {
    const filePath = path.join(tmpDir, 'new-append.txt');
    assert.equal(fileExists(filePath), false);
    appendFile(filePath, 'created by append');
    assert.equal(readFile(filePath), 'created by append\n');
  });

  test('appendFile creates intermediate directories', () => {
    const filePath = path.join(tmpDir, 'sub', 'dir', 'append.txt');
    appendFile(filePath, 'deep append');
    assert.equal(readFile(filePath), 'deep append\n');
  });

  test('ensureDir creates nested directories', () => {
    const deepDir = path.join(tmpDir, 'a', 'b', 'c', 'd');
    assert.equal(fs.existsSync(deepDir), false);
    ensureDir(deepDir);
    assert.equal(fs.statSync(deepDir).isDirectory(), true);
  });

  test('ensureDir is idempotent (no error if dir already exists)', () => {
    const dir = path.join(tmpDir, 'existing');
    fs.mkdirSync(dir);
    assert.doesNotThrow(() => ensureDir(dir));
  });

  test('fileExists returns true for existing file', () => {
    const filePath = path.join(tmpDir, 'exists.txt');
    writeFile(filePath, 'yes');
    assert.equal(fileExists(filePath), true);
  });

  test('fileExists returns false for missing file', () => {
    assert.equal(fileExists(path.join(tmpDir, 'missing.txt')), false);
  });

  test('fileExists returns true for existing directory', () => {
    assert.equal(fileExists(tmpDir), true);
  });
});

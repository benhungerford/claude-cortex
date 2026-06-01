'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function copyFixtureVault() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-boot-'));
  const fixtureDir = path.join(__dirname, 'fixtures', 'vault');
  fs.cpSync(fixtureDir, tmpDir, { recursive: true });
  return tmpDir;
}

function rmTmpDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

// Point the fixture registry's repo_paths at a real directory inside the
// temp vault so cwd-resolution (which normalizes paths) can match it.
function registerRepoPath(vault, repoAbsPath) {
  const regPath = path.join(vault, '.claude', 'cortex', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  reg.projects[0].repo_paths = [repoAbsPath];
  fs.mkdirSync(repoAbsPath, { recursive: true });
  fs.writeFileSync(regPath, JSON.stringify(reg, null, 2) + '\n');
}

// ---------------------------------------------------------------------------
// get_boot_context
// ---------------------------------------------------------------------------

describe('get_boot_context', () => {
  const tool = require('../tools/get-boot-context.js');
  const readHub = require('../tools/read-hub.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('exports the standard tool shape', () => {
    assert.equal(tool.name, 'get_boot_context');
    assert.ok(typeof tool.description === 'string' && tool.description.length > 0);
    assert.ok(tool.inputSchema && tool.inputSchema.type === 'object');
    assert.ok(typeof tool.handler === 'function');
  });

  test('returns core fields for a non-registered cwd', async () => {
    const outsideCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-outside-'));
    try {
      const result = await tool.handler({ cwd: outsideCwd }, tmpVault);
      assert.equal(result.isError, undefined, 'should not be an error');
      const data = JSON.parse(result.content[0].text);

      assert.equal(data.vault_path, tmpVault);
      assert.ok([1, 2].includes(data.activation_level), 'level should be 1 or 2');
      assert.equal(data.project, null, 'project null when not registered');
      assert.ok(typeof data.personality === 'string' && data.personality.length > 0,
        'personality should be non-empty');
      assert.equal(typeof data.inbox_count, 'number');
    } finally {
      rmTmpDir(outsideCwd);
    }
  });

  test('cwd inside the vault yields activation_level 2', async () => {
    const insideCwd = path.join(tmpVault, 'Work');
    const result = await tool.handler({ cwd: insideCwd }, tmpVault);
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.activation_level, 2);
    assert.equal(data.project, null);
    // L1/L2 should populate the bucket list
    assert.ok(data.active_projects === null || typeof data.active_projects === 'string');
  });

  test('L3 cwd resolves to project and matches read_hub parser output', async () => {
    const repoPath = path.join(tmpVault, '_repo', 'test-project');
    registerRepoPath(tmpVault, repoPath);

    // cwd is a subdirectory of the registered repo — should still resolve via walk-up.
    const nestedCwd = path.join(repoPath, 'src');
    fs.mkdirSync(nestedCwd, { recursive: true });

    const result = await tool.handler({ cwd: nestedCwd }, tmpVault);
    const data = JSON.parse(result.content[0].text);

    assert.equal(data.activation_level, 3, 'registered repo => L3');
    assert.ok(data.project, 'project should be present at L3');
    assert.equal(data.project.id, 'test-project');
    assert.equal(data.project.vault_path, 'Work/TBL/Test Client/Test Project');

    // Parser agreement: blockers + open_questions must match read_hub exactly.
    const hubResult = await readHub.handler(
      { project_path: 'Work/TBL/Test Client/Test Project' },
      tmpVault
    );
    const hub = JSON.parse(hubResult.content[0].text);

    assert.deepEqual(data.project.blockers, hub.blockers,
      'blockers must match read_hub');
    assert.deepEqual(data.project.open_questions, hub.open_questions,
      'open_questions must match read_hub');

    // stage + recent_decisions populated from hub / changelog
    assert.ok('stage' in data.project);
    assert.ok(Array.isArray(data.project.recent_decisions));
    // L3 => no bucket list
    assert.equal(data.active_projects, null);
  });

  test('returns error (onboarding needed) when personality.md is missing', async () => {
    // A valid vault dir with no personality.md => boot-context.py exits 1;
    // this tool returns an isError result so cortex-boot falls back to onboarding.
    const emptyVault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-empty-'));
    try {
      const result = await tool.handler({ cwd: emptyVault }, emptyVault);
      assert.equal(result.isError, true);
      assert.match(result.content[0].text, /personality/i);
    } finally {
      rmTmpDir(emptyVault);
    }
  });
});

'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  loadRegistry,
  saveRegistry,
  findProjectByRepoPath,
  findProjectByCwd,
  emptyRegistry,
  canonicalPath,
  legacyPath
} = require('../lib/registry.js');
const registerRepo = require('../tools/register-repo.js');

function makeVault() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-registry-'));
  fs.mkdirSync(path.join(dir, '.claude', 'cortex'), { recursive: true });
  return dir;
}

function rm(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe('registry: load/save canonical', () => {
  let vault;
  beforeEach(() => { vault = makeVault(); });
  afterEach(() => rm(vault));

  test('loadRegistry returns empty when no file exists', () => {
    const reg = loadRegistry(vault);
    assert.deepEqual(reg, emptyRegistry());
  });

  test('saveRegistry then loadRegistry round-trips', () => {
    const reg = {
      schema_version: 1,
      projects: [{ id: 'a', vault_path: 'Work/A', context_file: 'A.md', repo_paths: ['/tmp/a'] }]
    };
    saveRegistry(vault, reg);
    assert.ok(fs.existsSync(canonicalPath(vault)));
    assert.deepEqual(loadRegistry(vault), reg);
  });

  test('loadRegistry reads legacy _repo_registry.json when canonical missing', () => {
    const legacy = [
      { project_id: 'old', vault_path: 'Work/X', context_file: 'X.md', repo_path: '/tmp/x' },
      { project_id: 'old', vault_path: 'Work/X', context_file: 'X.md', repo_path: '/tmp/x2' }
    ];
    fs.writeFileSync(legacyPath(vault), JSON.stringify(legacy));
    const reg = loadRegistry(vault);
    assert.equal(reg.projects.length, 1);
    assert.deepEqual(reg.projects[0].repo_paths, ['/tmp/x', '/tmp/x2']);
  });

  test('loadRegistry throws on malformed JSON instead of overwriting', () => {
    fs.writeFileSync(canonicalPath(vault), '{broken');
    assert.throws(() => loadRegistry(vault));
  });
});

describe('registry: find functions', () => {
  const reg = {
    schema_version: 1,
    projects: [
      { id: 'a', vault_path: 'Work/A', context_file: 'A.md', repo_paths: ['/repos/a', '/repos/a-mirror'] },
      { id: 'b', vault_path: 'Work/B', context_file: 'B.md', repo_paths: ['/repos/b'] }
    ]
  };

  test('findProjectByRepoPath exact match', () => {
    assert.equal(findProjectByRepoPath(reg, '/repos/a').id, 'a');
    assert.equal(findProjectByRepoPath(reg, '/repos/a-mirror').id, 'a');
    assert.equal(findProjectByRepoPath(reg, '/repos/b').id, 'b');
    assert.equal(findProjectByRepoPath(reg, '/repos/c'), null);
  });

  test('findProjectByCwd walks up to ancestor match', () => {
    assert.equal(findProjectByCwd(reg, '/repos/a/src/lib').id, 'a');
    assert.equal(findProjectByCwd(reg, '/repos/b').id, 'b');
    assert.equal(findProjectByCwd(reg, '/elsewhere/path'), null);
  });
});

describe('register_repo tool', () => {
  let vault, repoDir;
  beforeEach(() => {
    vault = makeVault();
    repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-repo-'));
  });
  afterEach(() => {
    rm(vault);
    rm(repoDir);
  });

  test('creates a new project entry on first call', async () => {
    const result = await registerRepo.handler({
      project_id: 'p1',
      vault_path: 'Work/Foo',
      context_file: 'Foo.md',
      repo_path: repoDir
    }, vault);

    assert.equal(result.isError, undefined);
    const reg = loadRegistry(vault);
    assert.equal(reg.projects.length, 1);
    assert.equal(reg.projects[0].id, 'p1');
    assert.deepEqual(reg.projects[0].repo_paths, [repoDir]);
  });

  test('appends repo_path to existing project', async () => {
    saveRegistry(vault, {
      schema_version: 1,
      projects: [{ id: 'p1', vault_path: 'Work/Foo', context_file: 'Foo.md', repo_paths: ['/old/path'] }]
    });

    const result = await registerRepo.handler({
      project_id: 'p1',
      vault_path: 'Work/Foo',
      context_file: 'Foo.md',
      repo_path: repoDir
    }, vault);

    assert.equal(result.isError, undefined);
    const reg = loadRegistry(vault);
    assert.deepEqual(reg.projects[0].repo_paths, ['/old/path', repoDir]);
  });

  test('refuses conflict when repo_path is owned by another project', async () => {
    saveRegistry(vault, {
      schema_version: 1,
      projects: [{ id: 'owner', vault_path: 'Work/Owner', context_file: 'Owner.md', repo_paths: [repoDir] }]
    });

    const result = await registerRepo.handler({
      project_id: 'newcomer',
      vault_path: 'Work/N',
      context_file: 'N.md',
      repo_path: repoDir
    }, vault);

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /already registered to project "owner"/);
    // Registry untouched.
    const reg = loadRegistry(vault);
    assert.equal(reg.projects.length, 1);
    assert.equal(reg.projects[0].id, 'owner');
  });

  test('rejects non-existent repo_path', async () => {
    const result = await registerRepo.handler({
      project_id: 'p',
      vault_path: 'Work/P',
      context_file: 'P.md',
      repo_path: '/this/path/does/not/exist'
    }, vault);

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /does not exist/);
  });

  test('writes a changelog entry via shared formatter', async () => {
    await registerRepo.handler({
      project_id: 'p1',
      vault_path: 'Work/Foo',
      context_file: 'Foo.md',
      repo_path: repoDir
    }, vault);

    const log = fs.readFileSync(path.join(vault, '_changelog.txt'), 'utf8');
    assert.match(log, /CREATED \| FILE: registry\.json \| DEST: \.claude\/cortex\/ \|/);
  });

  test('idempotent on duplicate registration', async () => {
    const args = {
      project_id: 'p1',
      vault_path: 'Work/Foo',
      context_file: 'Foo.md',
      repo_path: repoDir
    };
    await registerRepo.handler(args, vault);
    const result = await registerRepo.handler(args, vault);
    const parsed = JSON.parse(result.content[0].text);
    assert.equal(parsed.action, 'noop');
    assert.equal(parsed.project.repo_paths.length, 1);
  });
});

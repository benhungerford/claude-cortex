'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const generateBase = require('../tools/generate-base.js');
const { clientProjectsBase, allProjectsBase } = require('../lib/base-templates.js');

describe('generate_base', () => {
  let vault;

  beforeEach(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-base-'));
    fs.mkdirSync(path.join(vault, 'Work/TBL/Acme'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(vault, { recursive: true, force: true });
  });

  test('client-projects template filters to project-context in scope folder', () => {
    const yaml = clientProjectsBase('Work/TBL/Acme');
    assert.match(yaml, /type == "project-context"/);
    assert.match(yaml, /file\.inFolder\("Work\/TBL\/Acme"\)/);
    assert.match(yaml, /type: table/);
    assert.match(yaml, /days_idle/);
  });

  test('writes .base file inside vault and logs CREATED', async () => {
    const result = await generateBase.handler({
      dest_path: 'Work/TBL/Acme/Acme — Projects.base',
      template: 'client-projects',
      scope_folder: 'Work/TBL/Acme'
    }, vault);
    assert.equal(result.isError, undefined);
    const written = fs.readFileSync(
      path.join(vault, 'Work/TBL/Acme/Acme — Projects.base'), 'utf8');
    assert.match(written, /filters:/);
    const log = fs.readFileSync(path.join(vault, '_changelog.txt'), 'utf8');
    assert.match(log, /CREATED/);
    assert.match(log, /Acme — Projects\.base/);
  });

  test('rejects dest_path without .base extension', async () => {
    const result = await generateBase.handler({
      dest_path: 'Work/TBL/Acme/notes.md',
      template: 'client-projects',
      scope_folder: 'Work/TBL/Acme'
    }, vault);
    assert.equal(result.isError, true);
  });

  test('rejects unknown template', async () => {
    const result = await generateBase.handler({
      dest_path: 'Work/TBL/Acme/x.base',
      template: 'nope',
      scope_folder: 'Work/TBL/Acme'
    }, vault);
    assert.equal(result.isError, true);
  });

  test('refuses to overwrite an existing .base file', async () => {
    const dest = path.join(vault, 'Work/TBL/Acme/Acme — Projects.base');
    fs.writeFileSync(dest, 'views: []\n');
    const result = await generateBase.handler({
      dest_path: 'Work/TBL/Acme/Acme — Projects.base',
      template: 'client-projects',
      scope_folder: 'Work/TBL/Acme'
    }, vault);
    assert.equal(result.isError, true);
    assert.equal(fs.readFileSync(dest, 'utf8'), 'views: []\n');
  });

  test('all-projects template has no folder filter when scope is vault root', () => {
    const yaml = allProjectsBase('');
    assert.match(yaml, /type == "project-context"/);
    assert.doesNotMatch(yaml, /inFolder\(""\)/);
  });
});

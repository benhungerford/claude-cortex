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

// ---------------------------------------------------------------------------
// validate_frontmatter
// ---------------------------------------------------------------------------

describe('validate_frontmatter', () => {
  const tool = require('../tools/validate-frontmatter.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('validates a correct file as valid', async () => {
    const result = await tool.handler(
      { file_path: 'Work/TBL/Test Client/Test Project/Test Project — Project Context.md' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.valid, true, 'file should be valid');
    assert.deepEqual(data.errors, [], 'should have no errors');
  });

  test('detects missing updated field', async () => {
    // Create a file missing the `updated` field
    const badContent = `---
type: project-context
project: "Bad Project"
client: "Test Client"
status: "Active Build"
created: 2026-04-01
tags:
  - "#type/project-context"
---

# Bad Project
`;
    const badFilePath = path.join(tmpVault, 'Work/TBL/Test Client/bad-note.md');
    fs.writeFileSync(badFilePath, badContent, 'utf8');

    const result = await tool.handler(
      { file_path: 'Work/TBL/Test Client/bad-note.md' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'handler should not error');
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.valid, false, 'file should be invalid');
    assert.ok(data.errors.some(e => e.includes('updated')), 'errors should mention missing updated field');
  });

  test('detects null values in tags array (unquoted # tags)', async () => {
    // js-yaml parses unquoted #foo as a comment → null in array
    // Simulate a file that was already parsed with a null tag
    const badContent = `---
created: 2026-04-01
updated: 2026-04-06
tags:
  - "#type/meeting-notes"
  -
---

# Null Tag Test
`;
    const badFilePath = path.join(tmpVault, 'Work/TBL/Test Client/null-tag-note.md');
    fs.writeFileSync(badFilePath, badContent, 'utf8');

    const result = await tool.handler(
      { file_path: 'Work/TBL/Test Client/null-tag-note.md' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'handler should not error');
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.valid, false, 'file with null tag should be invalid');
    assert.ok(data.errors.some(e => e.includes('null')), 'errors should mention null tag');
  });
});

// ---------------------------------------------------------------------------
// scaffold_project
// ---------------------------------------------------------------------------

describe('scaffold_project', () => {
  const tool = require('../tools/scaffold-project.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('creates all 6 required project files', async () => {
    const result = await tool.handler(
      { client: 'Test Client', project: 'New Project', category: 'TBL' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const projectBase = path.join(tmpVault, 'Work/TBL/Test Client/New Project');
    assert.ok(fs.existsSync(path.join(projectBase, '_MOC.md')), '_MOC.md should exist');
    assert.ok(fs.existsSync(path.join(projectBase, 'New Project — Project Context.md')), 'Project Context should exist');
    assert.ok(fs.existsSync(path.join(projectBase, 'Tech Stack & Architecture.md')), 'Tech Stack should exist');
    assert.ok(fs.existsSync(path.join(projectBase, 'Design System.md')), 'Design System should exist');
    assert.ok(fs.existsSync(path.join(projectBase, 'Changelog.md')), 'Changelog should exist');
    assert.ok(fs.existsSync(path.join(projectBase, 'Notes/_MOC.md')), 'Notes/_MOC.md should exist');
  });

  test('creates client folder structure if client does not exist', async () => {
    const result = await tool.handler(
      { client: 'Brand New Client', project: 'First Project', category: 'TBL' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const clientBase = path.join(tmpVault, 'Work/TBL/Brand New Client');
    assert.ok(fs.existsSync(path.join(clientBase, '_MOC.md')), 'client _MOC.md should exist');
    assert.ok(fs.existsSync(path.join(clientBase, 'Brand New Client — Client Context.md')), 'Client Context should exist');
    assert.ok(fs.existsSync(path.join(clientBase, 'Meetings/_MOC.md')), 'Meetings/_MOC.md should exist');
  });

  test('uses brand folder for personal projects', async () => {
    const result = await tool.handler(
      { client: 'Ben Hungerford', project: 'Web App Build', category: 'Personal', brand: 'The Workout App' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const projectBase = path.join(tmpVault, 'Work/Personal/Ben Hungerford/The Workout App/Web App Build');
    assert.ok(fs.existsSync(path.join(projectBase, '_MOC.md')), 'project _MOC.md should exist at brand path');
    assert.ok(fs.existsSync(path.join(projectBase, 'Web App Build — Project Context.md')), 'Project Context should exist');
  });

  test('sets correct frontmatter on project context', async () => {
    const result = await tool.handler(
      { client: 'Test Client', project: 'Typed Project', category: 'TBL', status: 'Active Build', domain: 'shopify' },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const contextPath = path.join(tmpVault, 'Work/TBL/Test Client/Typed Project/Typed Project — Project Context.md');
    const content = fs.readFileSync(contextPath, 'utf8');

    assert.ok(content.includes('status: Active Build'), 'status should be Active Build');
    assert.ok(content.includes('"#type/project-context"'), 'tags should include project-context (quoted)');
    assert.ok(content.includes('"#domain/shopify"'), 'tags should include domain/shopify (quoted)');
  });

  test('logs CREATED entries to _changelog.txt', async () => {
    await tool.handler(
      { client: 'Test Client', project: 'Logged Project', category: 'TBL' },
      tmpVault
    );

    const changelogPath = path.join(tmpVault, '_changelog.txt');
    const contents = fs.readFileSync(changelogPath, 'utf8');

    assert.ok(contents.includes('CREATED'), 'changelog should have CREATED entries');
    assert.ok(contents.includes('Logged Project'), 'changelog should mention the project name');
  });
});

// ---------------------------------------------------------------------------
// thread_meeting
// ---------------------------------------------------------------------------

describe('thread_meeting', () => {
  const tool = require('../tools/thread-meeting.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('threads a 4th meeting into an existing 3-note series', async () => {
    const notesDir = path.join(tmpVault, 'Work/TBL/Test Client/Test Project/Notes');
    const newFile = '2026-03-22 Client Check-in.md';

    // Create the new meeting note file
    const newContent = `---
created: 2026-03-22T14:00
updated: 2026-03-22T15:00
tags:
  - "#type/meeting-notes"
---

# 2026-03-22 Client Check-in

Fourth meeting.

---
*Related:* [[_MOC]]
`;
    fs.writeFileSync(path.join(notesDir, newFile), newContent, 'utf8');

    const result = await tool.handler(
      { notes_dir: 'Work/TBL/Test Client/Test Project/Notes', new_file: newFile },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');
    const data = JSON.parse(result.content[0].text);
    assert.equal(data.threaded, true, 'should have threaded');

    // New note should have *Previous:* pointing to the prior note
    const newNoteContent = fs.readFileSync(path.join(notesDir, newFile), 'utf8');
    assert.ok(
      newNoteContent.includes('*Previous:* [[2026-03-15 Client Check-in]]'),
      'new note should have Previous link to 2026-03-15'
    );

    // Prior note (2026-03-15) should now have *Next:* pointing to the new note
    const priorContent = fs.readFileSync(
      path.join(notesDir, '2026-03-15 Client Check-in.md'),
      'utf8'
    );
    assert.ok(
      priorContent.includes('*Next:* [[2026-03-22 Client Check-in]]'),
      '2026-03-15 note should have Next link to 2026-03-22'
    );
  });

  test('skips threading for a one-off meeting with a unique title', async () => {
    const notesDir = path.join(tmpVault, 'Work/TBL/Test Client/Test Project/Notes');
    const oneOffFile = '2026-03-22 One-Off Strategy Session.md';

    // Create the one-off file
    const oneOffContent = `---
created: 2026-03-22T14:00
updated: 2026-03-22T15:00
tags:
  - "#type/meeting-notes"
---

# 2026-03-22 One-Off Strategy Session

Unique meeting, no series.

---
*Related:* [[_MOC]]
`;
    fs.writeFileSync(path.join(notesDir, oneOffFile), oneOffContent, 'utf8');

    const result = await tool.handler(
      { notes_dir: 'Work/TBL/Test Client/Test Project/Notes', new_file: oneOffFile },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');
    // Result should NOT be threaded — message should mention skipping
    const text = result.content[0].text;
    // It should either say "Skipping" or not have threaded:true
    const isSkipped = text.includes('Skipping') || text.includes('skip') ||
      (text.startsWith('{') && JSON.parse(text).threaded !== true);
    assert.ok(isSkipped, 'one-off meeting should not be threaded');

    // The file should not have a *Previous:* link added
    const fileContent = fs.readFileSync(path.join(notesDir, oneOffFile), 'utf8');
    assert.ok(!fileContent.includes('*Previous:*'), 'one-off note should not have Previous link');
  });
});

// ---------------------------------------------------------------------------
// check_dormant_features
// ---------------------------------------------------------------------------

describe('check_dormant_features', () => {
  const tool = require('../tools/check-dormant-features.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('returns ready and not_ready lists — fixture has 1 project and ~4 dates so both features not_ready', async () => {
    const result = await tool.handler({}, tmpVault);

    assert.equal(result.isError, undefined, 'should not be an error');

    const data = JSON.parse(result.content[0].text);
    assert.ok(Array.isArray(data.ready), 'ready should be an array');
    assert.ok(Array.isArray(data.not_ready), 'not_ready should be an array');

    // Fixture has 1 active project (need 3+) and 4 unique dates (need 10+)
    // Both features should be not_ready
    assert.equal(data.ready.length, 0, 'no features should be ready with fixture data');
    assert.equal(data.not_ready.length, 2, 'both features should be not_ready');

    const featureNames = data.not_ready.map(f => f.feature);
    assert.ok(featureNames.includes('weekly_review'), 'weekly_review should be not_ready');
    assert.ok(featureNames.includes('daily_briefing'), 'daily_briefing should be not_ready');
  });

  test('each entry has feature, signal, and evidence fields', async () => {
    const result = await tool.handler({}, tmpVault);
    const data = JSON.parse(result.content[0].text);

    for (const entry of [...data.ready, ...data.not_ready]) {
      assert.ok('feature' in entry, 'entry should have feature');
      assert.ok('signal' in entry, 'entry should have signal');
      assert.ok('evidence' in entry, 'entry should have evidence');
    }
  });
});

// ---------------------------------------------------------------------------
// list_projects
// ---------------------------------------------------------------------------

describe('list_projects', () => {
  const tool = require('../tools/list-projects.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('returns all projects — fixture has 1 project with correct fields', async () => {
    const result = await tool.handler({}, tmpVault);

    assert.equal(result.isError, undefined, 'should not be an error');

    const projects = JSON.parse(result.content[0].text);
    assert.ok(Array.isArray(projects), 'result should be an array');
    assert.equal(projects.length, 1, 'fixture has exactly 1 project');

    const p = projects[0];
    assert.equal(p.project, 'Test Project', 'project name should match');
    assert.equal(p.client, 'Test Client', 'client should match');
    assert.equal(p.status, 'Active Build', 'status should match');
    assert.equal(p.open_questions, 2, 'should count 2 open questions');
    assert.equal(p.blockers, 0, 'should count 0 blockers (no Blockers section)');
    assert.ok('updated' in p, 'should have updated field');
    assert.ok('vault_path' in p, 'should have vault_path field');
  });

  test('status_filter for "Paused" returns empty array', async () => {
    const result = await tool.handler({ status_filter: 'Paused' }, tmpVault);

    assert.equal(result.isError, undefined, 'should not be an error');

    const projects = JSON.parse(result.content[0].text);
    assert.equal(projects.length, 0, 'no projects should match Paused status');
  });

  test('status_filter for "Active Build" returns the fixture project', async () => {
    const result = await tool.handler({ status_filter: 'Active Build' }, tmpVault);

    assert.equal(result.isError, undefined, 'should not be an error');

    const projects = JSON.parse(result.content[0].text);
    assert.equal(projects.length, 1, 'one project matches Active Build');
    assert.equal(projects[0].project, 'Test Project');
  });
});

// ---------------------------------------------------------------------------
// open_question
// ---------------------------------------------------------------------------

describe('open_question', () => {
  const tool = require('../tools/open-question.js');
  let tmpVault;

  beforeEach(() => { tmpVault = copyFixtureVault(); });
  afterEach(() => { rmTmpDir(tmpVault); });

  test('adds a new open question to the project context', async () => {
    const result = await tool.handler(
      {
        project_path: 'Work/TBL/Test Client/Test Project',
        action: 'add',
        text: 'What CDN should we use?'
      },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const contextPath = path.join(tmpVault, 'Work/TBL/Test Client/Test Project/Test Project — Project Context.md');
    const contents = fs.readFileSync(contextPath, 'utf8');
    assert.ok(contents.includes('- [ ] What CDN should we use?'), 'new question should appear unchecked');
  });

  test('resolves an existing question by substring match', async () => {
    const result = await tool.handler(
      {
        project_path: 'Work/TBL/Test Client/Test Project',
        action: 'resolve',
        text: 'API integration',
        resolution: 'Using REST API with OAuth2'
      },
      tmpVault
    );

    assert.equal(result.isError, undefined, 'should not be an error');

    const contextPath = path.join(tmpVault, 'Work/TBL/Test Client/Test Project/Test Project — Project Context.md');
    const contents = fs.readFileSync(contextPath, 'utf8');
    assert.ok(!contents.includes('- [ ] How should we handle the API integration?'), 'question should no longer be unchecked');
    assert.ok(contents.includes('- [x]'), 'resolved question should be checked');
    assert.ok(contents.includes('Using REST API with OAuth2'), 'resolution text should appear');
  });

  test('returns error when resolving without resolution text', async () => {
    const result = await tool.handler(
      {
        project_path: 'Work/TBL/Test Client/Test Project',
        action: 'resolve',
        text: 'API integration'
      },
      tmpVault
    );

    assert.equal(result.isError, true, 'should be an error');
    assert.ok(result.content[0].text.includes('resolution'), 'error should mention resolution');
  });

  test('returns error when no matching question found', async () => {
    const result = await tool.handler(
      {
        project_path: 'Work/TBL/Test Client/Test Project',
        action: 'resolve',
        text: 'nonexistent question nobody would ask',
        resolution: 'some answer'
      },
      tmpVault
    );

    assert.equal(result.isError, true, 'should be an error');
    assert.ok(result.content[0].text.includes('No matching'), 'error should mention no match');
  });

  test('bumps updated date in frontmatter after add', async () => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

    await tool.handler(
      {
        project_path: 'Work/TBL/Test Client/Test Project',
        action: 'add',
        text: 'New question for date test'
      },
      tmpVault
    );

    const contextPath = path.join(tmpVault, 'Work/TBL/Test Client/Test Project/Test Project — Project Context.md');
    const contents = fs.readFileSync(contextPath, 'utf8');
    assert.ok(contents.includes(todayStr), 'updated date should be bumped to today');
  });

  test('appends entry to _changelog.txt', async () => {
    await tool.handler(
      {
        project_path: 'Work/TBL/Test Client/Test Project',
        action: 'add',
        text: 'Changelog test question'
      },
      tmpVault
    );

    const changelogPath = path.join(tmpVault, '_changelog.txt');
    const contents = fs.readFileSync(changelogPath, 'utf8');
    assert.ok(contents.includes('Changelog test question'), 'changelog should mention the question text');
  });
});

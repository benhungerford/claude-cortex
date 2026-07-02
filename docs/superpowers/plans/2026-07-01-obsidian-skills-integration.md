# Obsidian Skills Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Incorporate three capabilities from kepano/obsidian-skills into Cortex: (1) Obsidian-native markdown syntax in all vault write paths, (2) self-updating `.base` dashboard views alongside MOCs, (3) defuddle-based clean web clipping.

**Architecture:** A new syntax reference file (`references/obsidian-syntax.md`) is wired into every skill that writes vault notes. A new `generate_base` MCP tool emits `.base` YAML files from templates; `scaffold_project` calls the same template code to give every new client a live `Projects.base` dashboard embedded in its `_MOC.md`; a backfill script adds dashboards to existing clients. Defuddle becomes the preferred URL-fetch path in `cortex-knowledge` and the generated daily routine.

**Tech Stack:** Node.js (CommonJS, `node:test`), Markdown skill/reference files, Obsidian Bases YAML (spec per kepano/obsidian-skills), Defuddle CLI (`npm i -g defuddle`).

## Global Constraints

- **Hub blocker table is sacred.** `## Open Questions & Blockers` pipe-table format (see `references/hub-schema.md`) is parsed by `mcp-servers/cortex-vault/lib/hub-schema.js` AND `hooks/lib/boot-context.py`. No task may convert it to callouts, embeds, or any other representation.
- **MOCs stay wikilink-based.** `update_moc` tooling and readers depend on `- [[Entry]]` lists. `.base` views are ADDED to MOCs via embed (`![[...base]]`), never replace the lists.
- **YAML tags always quoted strings** (`- "#type/moc"`), per `references/vault-conventions.md`.
- **Every vault write logs to `_changelog.txt`** via `formatChangelogEntry` (action vocabulary: MOVED, TAGGED, CREATED, PULLED, SKIPPED, UNKNOWN, MEMORY_UPDATED).
- **Tests:** `cd mcp-servers/cortex-vault && npm test` (runs `node --test tests/*.test.js`). All existing tests must stay green.
- **Branch:** create `feat/obsidian-skills-integration` off `main` before Task 1 (current checkout is on `fix/cortex-sessionstart-null-formatter`).
- **Base file naming:** client dashboards are named `<Client> — Projects.base` (client name prefix avoids cross-client wikilink ambiguity in Obsidian).
- **Defuddle is optional at runtime.** Every defuddle instruction must include the fallback: if `defuddle` CLI is not installed, use WebFetch and continue (optionally suggest `npm install -g defuddle` once).

---

### Task 1: Obsidian syntax reference file

**Files:**
- Create: `references/obsidian-syntax.md`

**Interfaces:**
- Produces: `references/obsidian-syntax.md` — referenced by name in Task 2's skill/workflow edits.

- [ ] **Step 1: Write the reference file**

Create `references/obsidian-syntax.md` with exactly this content:

````markdown
# Obsidian Syntax — Write-Path Reference

Distilled from Obsidian Flavored Markdown (kepano/obsidian-skills). Every Cortex
skill that writes a vault note follows these rules. Standard Markdown is assumed;
this covers only Obsidian extensions and where Cortex uses them.

## Wikilinks

```markdown
[[Note Name]]                    Link to note
[[Note Name|Display Text]]       Custom display text
[[Note Name#Heading]]            Link to a heading
[[Note Name#^block-id]]          Link to a specific block
```

Use `[[wikilinks]]` for all internal links (Obsidian tracks renames); use
`[text](url)` only for external URLs. See `vault-conventions.md` for link
density and footer rules.

## Block IDs

Append `^block-id` to any paragraph to make it linkable:

```markdown
Decided: inventory sync runs every 15 min. ^dec-2026-07-01-1
```

For lists, quotes, and tables, the block ID goes on its own line AFTER the block.

**Cortex rule — decisions get block IDs.** When writing a decision to a hub's
`## Key Decisions` section, append `^dec-YYYY-MM-DD-n` (n = 1-based counter for
that day). The matching Changelog entry links to it:
`[[<Project> — Project Context#^dec-2026-07-01-1]]`.

## Callouts

```markdown
> [!type] Optional title
> Body of the callout.
```

Types Cortex uses (others exist but keep to these):

| Type | Cortex use |
|---|---|
| `> [!summary]` | TL;DR block at the top of meeting notes |
| `> [!warning]` | Vendor quirks / gotchas in Knowledge Base articles |
| `> [!tip]` | Workarounds and recipes in Knowledge Base articles |
| `> [!question]` | Unresolved items inside meeting notes (NOT the hub table) |

Foldable: `> [!type]-` starts collapsed. Use collapsed for long meeting TL;DRs.

**NEVER** use callouts for the hub `## Open Questions & Blockers` table —
that table's pipe format is machine-parsed (see `hub-schema.md`).

## Embeds

```markdown
![[Note Name]]                   Embed entire note
![[Note Name#Heading]]           Embed one section
![[Note Name#^block-id]]         Embed one block
![[image.png]]                   Embed image
![[Client — Projects.base]]      Embed a Bases view
```

**Cortex rule — embed instead of copying.** When a hub or weekly review needs
a meeting's decisions, embed the section (`![[2026-07-01 Client Call#Decisions]]`)
rather than duplicating text that will go stale.

## Properties (frontmatter)

Frontmatter is YAML between `---` fences at the very top of the file.
Property types Obsidian understands: text, list, number, checkbox (true/false),
date (`YYYY-MM-DD`), datetime (`YYYY-MM-DDTHH:mm`).

Cortex-specific rules (see `vault-conventions.md` for the full schema):
- Tags are quoted strings: `- "#type/moc"` — `#` unquoted is a YAML comment.
- Dates are plain `YYYY-MM-DD` strings.
- Hub fields `type`, `project`, `client`, `status` drive `.base` dashboards —
  never rename them.

## Comments

`%%text%%` is visible in edit mode only. Cortex does not write comments to
vault notes (they hide content from readers and from search snippets).
````

- [ ] **Step 2: Verify the file renders**

Run: `head -20 references/obsidian-syntax.md`
Expected: frontmatter-free markdown starting with `# Obsidian Syntax — Write-Path Reference`.

- [ ] **Step 3: Commit**

```bash
git add references/obsidian-syntax.md
git commit -m "feat(references): add Obsidian syntax write-path reference"
```

---

### Task 2: Wire syntax rules into write-path skills

**Files:**
- Modify: `references/vault-conventions.md` (Wikilinks section)
- Modify: `skills/cortex-update-context/SKILL.md`
- Modify: `skills/cortex-process-meeting/SKILL.md`
- Modify: `skills/cortex-knowledge/SKILL.md`
- Modify: `skills/cortex-ingest-project/SKILL.md`
- Modify: `workflows/update-context.md`
- Modify: `workflows/process-meeting.md`
- Modify: `workflows/capture-knowledge.md`
- Modify: `workflows/ingest-project.md`

**Interfaces:**
- Consumes: `references/obsidian-syntax.md` (Task 1).
- Produces: consistent instruction blocks named "Obsidian syntax" in each skill/workflow.

- [ ] **Step 1: Add pointer in `references/vault-conventions.md`**

In the `**Wikilinks**` block, after the line `Full reference: see \`wikilink-guidelines.md\` in the vault's \`.claude/rules/\` directory.`, insert:

```markdown
**Obsidian syntax (callouts, embeds, block IDs)**

All write paths follow `references/obsidian-syntax.md`: decisions get
`^dec-YYYY-MM-DD-n` block IDs, meeting notes open with a `> [!summary]` callout,
Knowledge Base quirks use `> [!warning]` / `> [!tip]`, and shared content is
embedded (`![[Note#Section]]`) instead of copied. The hub
`## Open Questions & Blockers` table is exempt — its pipe format is canonical.
```

- [ ] **Step 2: Add "Obsidian syntax" rule block to each of the 4 SKILL.md files**

In each file's `## Critical rules` section (create the bullet at the end of that section), add the skill-appropriate rule:

`skills/cortex-update-context/SKILL.md`:
```markdown
**Obsidian syntax.** Follow `references/obsidian-syntax.md`. Decisions written to
`## Key Decisions` get a `^dec-YYYY-MM-DD-n` block ID; the paired Changelog entry
links to it as `[[<Project> — Project Context#^dec-YYYY-MM-DD-n]]`. The
`## Open Questions & Blockers` table format never changes (hub-schema.md).
```

`skills/cortex-process-meeting/SKILL.md`:
```markdown
**Obsidian syntax.** Follow `references/obsidian-syntax.md`. Meeting notes open
with a `> [!summary]` callout (collapsed `> [!summary]-` if longer than 4 lines).
Decisions extracted to the hub get block IDs per the decision rule; the hub may
embed the meeting's decisions section (`![[<Meeting Note>#Decisions]]`) instead
of copying text.
```

`skills/cortex-knowledge/SKILL.md`:
```markdown
**Obsidian syntax.** Follow `references/obsidian-syntax.md`. Vendor quirks are
`> [!warning]` callouts; workarounds/recipes are `> [!tip]` callouts. Keep the
Problem/Solution/Example (pattern), Quirk/Workaround/Context (vendor note), and
step-by-step (guide) structures — callouts wrap the quirk and workaround bodies.
```

`skills/cortex-ingest-project/SKILL.md`:
```markdown
**Obsidian syntax.** Follow `references/obsidian-syntax.md` for all scaffolded
content beyond the fixed templates: briefs pasted into the hub Overview keep
their structure, key facts become properties, and any decision already present
in the brief gets a `^dec-YYYY-MM-DD-n` block ID in `## Key Decisions`.
```

- [ ] **Step 3: Mirror the same rules into the 4 workflow files**

Each workflow file (`workflows/update-context.md`, `workflows/process-meeting.md`, `workflows/capture-knowledge.md`, `workflows/ingest-project.md`) gets the same block as its SKILL.md, inserted at the step where note content is composed (the step that writes/edits the note body — locate the step describing content formatting and append the block there). Read each workflow before editing; do not renumber existing steps.

- [ ] **Step 4: Verify no hub-table drift**

Run: `grep -rn "Open Questions & Blockers" skills/ workflows/ references/obsidian-syntax.md | grep -i "callout\|embed"`
Expected: matches only the exemption sentences ("never", "exempt"), no instruction to convert the table.

- [ ] **Step 5: Run existing test suite (guard against accidental fixture edits)**

Run: `cd mcp-servers/cortex-vault && npm test && cd ../.. && bash tests/run-hook-tests.sh`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add references/vault-conventions.md skills/ workflows/
git commit -m "feat(skills): wire Obsidian syntax rules into all vault write paths"
```

---

### Task 3: `generate_base` MCP tool

**Files:**
- Create: `mcp-servers/cortex-vault/lib/base-templates.js`
- Create: `mcp-servers/cortex-vault/tools/generate-base.js`
- Modify: `mcp-servers/cortex-vault/server.js` (add one `registerTool` line after line 27)
- Test: `mcp-servers/cortex-vault/tests/generate-base.test.js`

**Interfaces:**
- Consumes: `getVaultPath`/`resolveInsideVault` (`lib/vault-path.js`), `writeFile`/`appendFile`/`fileExists` (`lib/file-ops.js`), `formatChangelogEntry` (`lib/changelog-format.js`).
- Produces:
  - `lib/base-templates.js` exports `clientProjectsBase(scopeFolder)` and `allProjectsBase(scopeFolder)` — both `(string) => string` returning complete `.base` YAML.
  - `generate_base` tool: `{ dest_path: string, template: 'client-projects'|'all-projects', scope_folder: string }` → writes the `.base` file, logs CREATED, returns text confirmation. Task 4 and Task 5 both import `base-templates.js`.

- [ ] **Step 1: Write the failing test**

Create `mcp-servers/cortex-vault/tests/generate-base.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-servers/cortex-vault && node --test tests/generate-base.test.js`
Expected: FAIL — `Cannot find module '../tools/generate-base.js'`.

- [ ] **Step 3: Write `lib/base-templates.js`**

```js
'use strict';

// Obsidian Bases YAML templates (JSON Canvas / Bases spec per
// https://help.obsidian.md/bases). Filter strings are single-quoted inside
// the YAML so the double-quoted property values survive.

function folderFilterLine(scopeFolder) {
  if (!scopeFolder) return '';
  return `    - 'file.inFolder("${scopeFolder}")'\n`;
}

function projectsBase(scopeFolder) {
  return (
    'filters:\n' +
    '  and:\n' +
    `    - 'type == "project-context"'\n` +
    folderFilterLine(scopeFolder) +
    'formulas:\n' +
    `  days_idle: '(now() - file.mtime).days'\n` +
    'properties:\n' +
    '  note.status:\n' +
    '    displayName: Status\n' +
    '  note.client:\n' +
    '    displayName: Client\n' +
    '  formula.days_idle:\n' +
    '    displayName: Days idle\n' +
    'views:\n' +
    '  - type: table\n' +
    '    name: Projects\n' +
    '    order:\n' +
    '      - file.name\n' +
    '      - status\n' +
    '      - client\n' +
    '      - updated\n' +
    '      - formula.days_idle\n' +
    '  - type: table\n' +
    '    name: Active\n' +
    '    filters:\n' +
    '      and:\n' +
    `        - '!status.contains("Archived")'\n` +
    '    order:\n' +
    '      - file.name\n' +
    '      - status\n' +
    '      - updated\n'
  );
}

function clientProjectsBase(scopeFolder) {
  return projectsBase(scopeFolder);
}

function allProjectsBase(scopeFolder) {
  return projectsBase(scopeFolder);
}

module.exports = { clientProjectsBase, allProjectsBase };
```

- [ ] **Step 4: Write `tools/generate-base.js`**

```js
'use strict';

const path = require('node:path');
const { getVaultPath, resolveInsideVault, VaultPathError } = require('../lib/vault-path.js');
const { writeFile, appendFile, fileExists } = require('../lib/file-ops.js');
const { formatChangelogEntry } = require('../lib/changelog-format.js');
const { clientProjectsBase, allProjectsBase } = require('../lib/base-templates.js');

const TEMPLATES = {
  'client-projects': clientProjectsBase,
  'all-projects': allProjectsBase,
};

async function handler(args, vaultOverride) {
  const { dest_path, template, scope_folder = '' } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return { content: [{ type: 'text', text: 'Vault path not configured.' }], isError: true };
  }
  if (typeof dest_path !== 'string' || !dest_path.endsWith('.base')) {
    return { content: [{ type: 'text', text: 'dest_path must end in .base' }], isError: true };
  }
  const render = TEMPLATES[template];
  if (!render) {
    return {
      content: [{ type: 'text', text: `Unknown template: ${template}. Valid: ${Object.keys(TEMPLATES).join(', ')}` }],
      isError: true
    };
  }

  let fullPath;
  try {
    fullPath = resolveInsideVault(vault, dest_path);
  } catch (err) {
    if (err instanceof VaultPathError) {
      return { content: [{ type: 'text', text: `Invalid dest_path: ${err.message}` }], isError: true };
    }
    throw err;
  }

  if (fileExists(fullPath)) {
    return {
      content: [{ type: 'text', text: `Refusing to overwrite existing file: ${dest_path}` }],
      isError: true
    };
  }

  writeFile(fullPath, render(scope_folder));

  const entry = formatChangelogEntry({
    action: 'CREATED',
    file: path.basename(dest_path),
    dest: dest_path,
    note: `Bases dashboard (${template})`
  });
  appendFile(path.join(vault, '_changelog.txt'), entry);

  return { content: [{ type: 'text', text: `Created ${dest_path} (${template})` }] };
}

module.exports = {
  name: 'generate_base',
  description: 'Generate an Obsidian Bases (.base) dashboard file from a template. Templates: client-projects (project hubs within a client folder), all-projects (every project hub in scope).',
  inputSchema: {
    type: 'object',
    properties: {
      dest_path: {
        type: 'string',
        description: 'Relative vault path for the new file, must end in .base (e.g. "Work/TBL/Acme/Acme — Projects.base").'
      },
      template: {
        type: 'string',
        enum: ['client-projects', 'all-projects'],
        description: 'Which dashboard template to render.'
      },
      scope_folder: {
        type: 'string',
        description: 'Vault-relative folder the view filters to via file.inFolder(). Empty string = whole vault.'
      }
    },
    required: ['dest_path', 'template']
  },
  handler
};
```

- [ ] **Step 5: Register the tool in `server.js`**

After the line `registerTool(require('./tools/open-question.js'));` add:

```js
registerTool(require('./tools/generate-base.js'));
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd mcp-servers/cortex-vault && node --test tests/generate-base.test.js && npm test`
Expected: new tests PASS, full suite PASS. If `tools.test.js` or `spec-drift.test.js` asserts a fixed tool count/list, update that expectation to include `generate_base`.

- [ ] **Step 7: Commit**

```bash
git add mcp-servers/cortex-vault/lib/base-templates.js mcp-servers/cortex-vault/tools/generate-base.js mcp-servers/cortex-vault/server.js mcp-servers/cortex-vault/tests/generate-base.test.js
git commit -m "feat(mcp): add generate_base tool for Obsidian Bases dashboards"
```

---

### Task 4: `scaffold_project` emits a client `Projects.base` dashboard

**Files:**
- Modify: `mcp-servers/cortex-vault/tools/scaffold-project.js` (client-creation block, lines 93–141)
- Test: `mcp-servers/cortex-vault/tests/generate-base.test.js` (append a describe block) or `tools.test.js` if scaffold coverage lives there — check first with `grep -l scaffold mcp-servers/cortex-vault/tests/*.test.js` and extend the file that already covers scaffold; if none, append to `generate-base.test.js` as below.

**Interfaces:**
- Consumes: `clientProjectsBase(scopeFolder)` from `lib/base-templates.js` (Task 3).
- Produces: on first-time client creation, `<clientRelPath>/<client> — Projects.base` exists and the client `_MOC.md` `## Projects` section contains `![[<client> — Projects.base]]`.

- [ ] **Step 1: Write the failing test**

Append to `mcp-servers/cortex-vault/tests/generate-base.test.js`:

```js
const scaffoldProject = require('../tools/scaffold-project.js');

describe('scaffold_project base dashboard', () => {
  let vault;

  beforeEach(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-scaffold-base-'));
  });

  afterEach(() => {
    fs.rmSync(vault, { recursive: true, force: true });
  });

  test('new client gets Projects.base embedded in client MOC', async () => {
    await scaffoldProject.handler({
      client: 'Acme', project: 'Site Build', category: 'TBL'
    }, vault);

    const basePath = path.join(vault, 'Work/TBL/Acme/Acme — Projects.base');
    assert.ok(fs.existsSync(basePath), 'base file created');
    assert.match(fs.readFileSync(basePath, 'utf8'), /file\.inFolder\("Work\/TBL\/Acme"\)/);

    const moc = fs.readFileSync(path.join(vault, 'Work/TBL/Acme/_MOC.md'), 'utf8');
    assert.match(moc, /!\[\[Acme — Projects\.base\]\]/);
  });

  test('second project under same client does not duplicate the base file', async () => {
    await scaffoldProject.handler({ client: 'Acme', project: 'One', category: 'TBL' }, vault);
    const before = fs.readFileSync(path.join(vault, 'Work/TBL/Acme/Acme — Projects.base'), 'utf8');
    await scaffoldProject.handler({ client: 'Acme', project: 'Two', category: 'TBL' }, vault);
    const after = fs.readFileSync(path.join(vault, 'Work/TBL/Acme/Acme — Projects.base'), 'utf8');
    assert.equal(before, after);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-servers/cortex-vault && node --test tests/generate-base.test.js`
Expected: FAIL — base file not created.

- [ ] **Step 3: Implement in `scaffold-project.js`**

Add import near the other lib requires:

```js
const { clientProjectsBase } = require('../lib/base-templates.js');
```

Inside the `if (!fileExists(clientMocPath)) {` block:

(a) Change the client MOC content line from:

```js
    const clientMocContent =
      yamlBlock(clientMocFm) +
      `\n# ${client}\n\n## Projects\n\n## Notes\n`;
```

to:

```js
    const clientMocContent =
      yamlBlock(clientMocFm) +
      `\n# ${client}\n\n## Projects\n\n![[${client} — Projects.base]]\n\n## Notes\n`;
```

(b) After the Meetings MOC write (end of the client-creation block, before the closing `}`), add:

```js
    // Client-level Bases dashboard — live view of project hubs in this folder
    const baseFile = `${client} — Projects.base`;
    writeFile(path.join(clientAbsPath, baseFile), clientProjectsBase(clientRelPath));
    created.push(`${clientRelPath}/${baseFile}`);
    logEntry(vault, baseFile, `${clientRelPath}/${baseFile}`, `Bases dashboard for ${client}`);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-servers/cortex-vault && npm test`
Expected: PASS (including the no-duplicate test — the base write is inside the client-creation guard, so second projects skip it).

- [ ] **Step 5: Commit**

```bash
git add mcp-servers/cortex-vault/tools/scaffold-project.js mcp-servers/cortex-vault/tests/generate-base.test.js
git commit -m "feat(scaffold): emit client Projects.base dashboard on client creation"
```

---

### Task 5: Backfill script for existing clients

**Files:**
- Create: `mcp-servers/cortex-vault/bin/generate-dashboards.js`
- Test: `mcp-servers/cortex-vault/tests/generate-dashboards.test.js`

**Interfaces:**
- Consumes: `clientProjectsBase(scopeFolder)` from `lib/base-templates.js` (Task 3).
- Produces: CLI `node mcp-servers/cortex-vault/bin/generate-dashboards.js [vaultPath]` (dry-run) / `--apply`. Exports `findClientFolders(vault)` and `backfill(vault, apply)` for the test.

- [ ] **Step 1: Write the failing test**

Create `mcp-servers/cortex-vault/tests/generate-dashboards.test.js`:

```js
'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { findClientFolders, backfill } = require('../bin/generate-dashboards.js');

function mkClient(vault, rel) {
  const abs = path.join(vault, rel);
  fs.mkdirSync(abs, { recursive: true });
  fs.writeFileSync(path.join(abs, '_MOC.md'),
    '---\ntype: client\n---\n\n# X\n\n## Projects\n\n## Notes\n');
}

describe('generate-dashboards backfill', () => {
  let vault;

  beforeEach(() => {
    vault = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-backfill-'));
    mkClient(vault, 'Work/TBL/Acme');
    mkClient(vault, 'Work/Personal/Me');
  });

  afterEach(() => {
    fs.rmSync(vault, { recursive: true, force: true });
  });

  test('finds client folders by type: client in _MOC frontmatter', () => {
    const found = findClientFolders(vault).sort();
    assert.deepEqual(found, ['Work/Personal/Me', 'Work/TBL/Acme']);
  });

  test('dry-run reports but writes nothing', () => {
    const plan = backfill(vault, false);
    assert.equal(plan.length, 2);
    assert.ok(!fs.existsSync(path.join(vault, 'Work/TBL/Acme/Acme — Projects.base')));
  });

  test('apply writes base files and embeds into MOC, idempotently', () => {
    backfill(vault, true);
    const basePath = path.join(vault, 'Work/TBL/Acme/Acme — Projects.base');
    assert.ok(fs.existsSync(basePath));
    const moc1 = fs.readFileSync(path.join(vault, 'Work/TBL/Acme/_MOC.md'), 'utf8');
    assert.match(moc1, /!\[\[Acme — Projects\.base\]\]/);

    // Second run: no duplicate embed, base untouched
    const baseBefore = fs.readFileSync(basePath, 'utf8');
    const plan2 = backfill(vault, true);
    assert.equal(plan2.length, 0);
    assert.equal(fs.readFileSync(basePath, 'utf8'), baseBefore);
    const moc2 = fs.readFileSync(path.join(vault, 'Work/TBL/Acme/_MOC.md'), 'utf8');
    assert.equal(moc2.split('Projects.base]]').length, 2, 'exactly one embed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd mcp-servers/cortex-vault && node --test tests/generate-dashboards.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `bin/generate-dashboards.js`**

Follow the structure of `bin/migrate-hubs.js` (read it first for arg parsing / logging conventions). Core implementation:

```js
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { clientProjectsBase } = require('../lib/base-templates.js');
const { formatChangelogEntry } = require('../lib/changelog-format.js');

// A "client folder" is any folder whose _MOC.md frontmatter contains
// `type: client`. Walk the vault, skipping dotfolders and known non-content dirs.
function findClientFolders(vault) {
  const out = [];
  const skip = new Set(['.obsidian', '.claude', '.git', 'node_modules']);
  (function walk(rel) {
    const abs = path.join(vault, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory() || skip.has(entry.name)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const mocPath = path.join(vault, childRel, '_MOC.md');
      if (fs.existsSync(mocPath)) {
        const head = fs.readFileSync(mocPath, 'utf8').slice(0, 500);
        if (/^type:\s*client\s*$/m.test(head)) {
          out.push(childRel);
          continue; // clients don't nest
        }
      }
      walk(childRel);
    }
  })('');
  return out;
}

function backfill(vault, apply) {
  const plan = [];
  for (const clientRel of findClientFolders(vault)) {
    const client = path.basename(clientRel);
    const baseFile = `${client} — Projects.base`;
    const baseAbs = path.join(vault, clientRel, baseFile);
    if (fs.existsSync(baseAbs)) continue;
    plan.push({ clientRel, baseFile });
    if (!apply) continue;

    fs.writeFileSync(baseAbs, clientProjectsBase(clientRel));

    const mocAbs = path.join(vault, clientRel, '_MOC.md');
    let moc = fs.readFileSync(mocAbs, 'utf8');
    const embed = `![[${baseFile}]]`;
    if (!moc.includes(embed)) {
      moc = moc.includes('## Projects')
        ? moc.replace('## Projects', `## Projects\n\n${embed}`)
        : moc.trimEnd() + `\n\n${embed}\n`;
      fs.writeFileSync(mocAbs, moc);
    }

    fs.appendFileSync(path.join(vault, '_changelog.txt'), formatChangelogEntry({
      action: 'CREATED',
      file: baseFile,
      dest: `${clientRel}/${baseFile}`,
      note: 'Backfilled Bases dashboard'
    }));
  }
  return plan;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const vault = args.find((a) => a !== '--apply');
  if (!vault) {
    console.error('Usage: node generate-dashboards.js <vaultPath> [--apply]');
    process.exit(1);
  }
  const plan = backfill(vault, apply);
  if (plan.length === 0) {
    console.log('Nothing to do — all client folders already have dashboards.');
  } else {
    for (const p of plan) console.log(`${apply ? 'CREATED' : 'WOULD CREATE'} ${p.clientRel}/${p.baseFile}`);
    if (!apply) console.log('\nDry run. Re-run with --apply to write.');
  }
}

module.exports = { findClientFolders, backfill };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd mcp-servers/cortex-vault && node --test tests/generate-dashboards.test.js && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mcp-servers/cortex-vault/bin/generate-dashboards.js mcp-servers/cortex-vault/tests/generate-dashboards.test.js
git commit -m "feat(bin): add generate-dashboards backfill script for existing clients"
```

---

### Task 6: Defuddle integration in cortex-knowledge and cortex-daily

**Files:**
- Modify: `skills/cortex-knowledge/SKILL.md` (Critical rules section)
- Modify: `workflows/capture-knowledge.md` (article-creation step)
- Modify: `skills/cortex-daily/assets/section-library.md` (web-fetch sections)
- Modify: `skills/cortex-daily/assets/routine-skeleton.md` ONLY IF it contains fetch instructions — read first; if fetching lives entirely in section-library.md, leave the skeleton untouched.

**Interfaces:**
- Consumes: nothing from earlier tasks (independent).
- Produces: a reusable instruction block named "URL fetching (defuddle)".

- [ ] **Step 1: Add rule to `skills/cortex-knowledge/SKILL.md`**

In `## Critical rules`, add:

```markdown
**URL fetching (defuddle).** When the knowledge source is a web page URL, fetch
it with the Defuddle CLI — `defuddle parse <url> --md` — and use the clean
markdown output as the article source. Exceptions: URLs ending in `.md` (already
markdown — use WebFetch directly). If the `defuddle` command is not installed,
fall back to WebFetch silently and, once per session at most, suggest
`npm install -g defuddle` for cleaner clips.
```

- [ ] **Step 2: Mirror in `workflows/capture-knowledge.md`**

Read the workflow; at the step where article content is gathered/composed, insert the same block verbatim.

- [ ] **Step 3: Update `skills/cortex-daily/assets/section-library.md`**

Read the file. In each section body that instructs fetching a web page (news, docs, articles — identify by instructions mentioning fetching URLs/pages), insert:

```markdown
Prefer `defuddle parse <url> --md` (Bash) over WebFetch for article pages — it
strips navigation and ads. If defuddle is not installed, use WebFetch and continue;
never fail the section over a missing CLI.
```

If no section fetches external pages, skip this file and note it in the commit message.

- [ ] **Step 4: Verify fallback language is everywhere**

Run: `grep -rln "defuddle" skills/ workflows/ | xargs grep -Ln "WebFetch"`
Expected: no output — every file mentioning defuddle also mentions the WebFetch fallback.

- [ ] **Step 5: Commit**

```bash
git add skills/cortex-knowledge/SKILL.md workflows/capture-knowledge.md skills/cortex-daily/assets/
git commit -m "feat(skills): prefer defuddle CLI for clean web clipping, WebFetch fallback"
```

---

### Task 7: Docs, changelog, version bump

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `.claude-plugin/plugin.json` (version bump 1.4.3 → 1.5.0 — minor: new features, no breaking changes)
- Modify: `README.md` ONLY IF it lists MCP tools or features — read first; add `generate_base` to any tool list found.

- [ ] **Step 1: Update CHANGELOG.md**

Add at the top, following the file's existing entry format (read it first):

```markdown
## 1.5.0 — 2026-07-01

- **Obsidian syntax in all write paths** — decisions get linkable block IDs,
  meeting notes open with summary callouts, Knowledge Base quirks/tips use
  callouts, shared content is embedded instead of copied
  (`references/obsidian-syntax.md`).
- **Bases dashboards** — new `generate_base` MCP tool; `scaffold_project` gives
  every new client a live `<Client> — Projects.base` view embedded in its MOC;
  `bin/generate-dashboards.js` backfills existing clients (dry-run by default).
- **Defuddle web clipping** — `cortex-knowledge` and generated daily routines
  prefer `defuddle parse <url> --md` for article fetches, with WebFetch fallback.
```

- [ ] **Step 2: Bump version in `.claude-plugin/plugin.json`**

Change `"version": "1.4.3"` to `"version": "1.5.0"`. Check `.claude-plugin/marketplace.json` for a version field too; bump if present.

- [ ] **Step 3: Full test pass**

Run: `cd mcp-servers/cortex-vault && npm test && cd ../.. && bash tests/run-hook-tests.sh`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md .claude-plugin/ README.md
git commit -m "chore(release): bump version to 1.5.0 for obsidian-skills integration"
```

---

## Post-implementation (manual, user-driven)

Not part of the automated plan — flag to the user at the end:

1. Run the backfill against the live vault: `node mcp-servers/cortex-vault/bin/generate-dashboards.js "/Users/benhungerford/Documents/The Vault"` (dry-run), review, then `--apply`.
2. Open one generated `.base` in Obsidian to confirm it renders (requires Obsidian with Bases support, v1.7+).
3. Optionally `npm install -g defuddle` on this machine.

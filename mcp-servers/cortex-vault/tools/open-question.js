'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { getVaultPath, resolveInsideVault, VaultPathError } = require('../lib/vault-path.js');
const { readFile, appendFile } = require('../lib/file-ops.js');
const { extractFrontmatter, stringifyYaml } = require('../lib/yaml.js');
const { formatChangelogEntry } = require('../lib/changelog-format.js');
const { addRow, resolveRow } = require('../lib/hub-schema.js');
const { updateFileAtomic, ConcurrencyError } = require('../lib/file-ops.js');

function todayDateStr() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function findProjectContextFile(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return null;
  }
  const match = entries.find(
    (f) => f.endsWith(' \u2014 Project Context.md') || f.endsWith(' — Project Context.md')
  );
  return match || null;
}

// Hub reads/writes go through the canonical pipe-table (lib/hub-schema.js).
// add  -> append a new "Open" row to "## Open Questions & Blockers".
// resolve -> REMOVE the matched row entirely (Blocker-Resolved Rule); the
//            removed text is logged to the Changelog, never left as a
//            strikethrough row.

async function handler(args, vaultOverride) {
  const { project_path, action, text, resolution, type, owner } = args;

  if (!project_path) {
    return {
      content: [{ type: 'text', text: 'project_path is required.' }],
      isError: true
    };
  }

  if (!action || !['add', 'resolve'].includes(action)) {
    return {
      content: [{ type: 'text', text: 'action must be "add" or "resolve".' }],
      isError: true
    };
  }

  if (!text) {
    return {
      content: [{ type: 'text', text: 'text is required.' }],
      isError: true
    };
  }

  if (action === 'resolve' && !resolution) {
    return {
      content: [{ type: 'text', text: 'resolution is required when action is "resolve".' }],
      isError: true
    };
  }

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  let fullDirPath;
  try {
    fullDirPath = resolveInsideVault(vault, project_path);
  } catch (err) {
    if (err instanceof VaultPathError) {
      return {
        content: [{ type: 'text', text: `Invalid project_path: ${err.message}` }],
        isError: true
      };
    }
    throw err;
  }
  const contextFileName = findProjectContextFile(fullDirPath);

  if (!contextFileName) {
    return {
      content: [{ type: 'text', text: `No Project Context file found in: ${project_path}` }],
      isError: true
    };
  }

  const filePath = path.join(fullDirPath, contextFileName);
  const fileContent = readFile(filePath);
  if (fileContent === null) {
    return {
      content: [{ type: 'text', text: `Could not read file: ${contextFileName}` }],
      isError: true
    };
  }

  // Hub read-modify-write is guarded by updateFileAtomic (advisory lock + CAS)
  // so two concurrent add/resolve calls on the same hub can't lose a write
  // (W3.7). Validation results surface via the closure vars below.
  let removedText = null;
  let opError = null;

  const transform = (content) => {
    const { frontmatter, body } = extractFrontmatter(content);
    let newBody;
    if (action === 'add') {
      newBody = addRow(body, { question: text, type: type || 'Question', owner: owner || '' });
    } else {
      // resolve — remove the row entirely
      const res = resolveRow(body, text);
      if (res.notFound) {
        opError = `No matching open question or blocker found for: "${text}"`;
        return null; // abort the write
      }
      if (res.error === 'ambiguous') {
        opError = `"${text}" matches multiple rows; be more specific. Candidates:\n` +
          res.candidates.map((c) => `  - ${c}`).join('\n');
        return null; // abort the write
      }
      newBody = res.content;
      removedText = res.removed;
    }
    const updatedFrontmatter = { ...frontmatter, updated: todayDateStr() };
    const yamlStr = stringifyYaml(updatedFrontmatter).trimEnd();
    return `---\n${yamlStr}\n---\n${newBody}`;
  };

  try {
    updateFileAtomic(filePath, transform, { retries: 3 });
  } catch (err) {
    if (err instanceof ConcurrencyError) {
      return {
        content: [{ type: 'text', text: `Hub was modified concurrently; please retry. (${err.message})` }],
        isError: true
      };
    }
    throw err;
  }

  if (opError) {
    return { content: [{ type: 'text', text: opError }], isError: true };
  }

  // Append changelog entry via shared formatter.
  const noteText = action === 'add'
    ? `Added open question: "${text}"`
    : `Resolved & removed "${removedText}": ${resolution}`;
  const entry = formatChangelogEntry({
    action: 'UPDATED',
    file: contextFileName,
    dest: `${project_path}/`,
    note: noteText
  });
  const changelogPath = path.join(vault, '_changelog.txt');
  appendFile(changelogPath, entry);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        action,
        file: contextFileName,
        note: noteText
      }, null, 2)
    }]
  };
}

module.exports = {
  name: 'open_question',
  description: 'Add or resolve an open question in a project hub (Project Context.md).',
  inputSchema: {
    type: 'object',
    properties: {
      project_path: {
        type: 'string',
        description: 'Relative vault path to the project folder (e.g. Work/TBL/Client/Project).'
      },
      action: {
        type: 'string',
        enum: ['add', 'resolve'],
        description: 'Action to perform: "add" a new question or "resolve" an existing one.'
      },
      text: {
        type: 'string',
        description: 'The question/blocker text (for add) or a substring to match the row (for resolve).'
      },
      type: {
        type: 'string',
        description: 'Optional (add only): row Type. Dependency/Internal/Unknown classify as blockers; anything else (default "Question") as an open question.'
      },
      owner: {
        type: 'string',
        description: 'Optional (add only): who owns the question/blocker.'
      },
      resolution: {
        type: 'string',
        description: 'Required for resolve: recorded in the Changelog when the row is removed.'
      }
    },
    required: ['project_path', 'action', 'text']
  },
  handler
};

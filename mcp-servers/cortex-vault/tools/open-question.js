'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { getVaultPath, resolveInsideVault, VaultPathError } = require('../lib/vault-path.js');
const { readFile, writeFile, appendFile } = require('../lib/file-ops.js');
const { extractFrontmatter, stringifyYaml } = require('../lib/yaml.js');
const { formatChangelogEntry } = require('../lib/changelog-format.js');

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

/**
 * Find or create the "## Open Questions" section and append a new unchecked item.
 */
function addQuestionToBody(body, text) {
  const sectionHeader = '## Open Questions';
  const idx = body.indexOf(sectionHeader);

  if (idx === -1) {
    // Section doesn't exist — append it at the end (before any footer)
    const footerIdx = body.lastIndexOf('\n---\n');
    const newItem = `- [ ] ${text}`;
    if (footerIdx !== -1) {
      return (
        body.slice(0, footerIdx) +
        `\n\n${sectionHeader}\n\n${newItem}\n` +
        body.slice(footerIdx)
      );
    }
    const trimmed = body.trimEnd();
    return `${trimmed}\n\n${sectionHeader}\n\n${newItem}\n`;
  }

  // Section exists — find its content end (start of next ## section or end of body)
  const afterHeader = idx + sectionHeader.length;
  const nextSection = body.indexOf('\n## ', afterHeader);
  const insertPos = nextSection !== -1 ? nextSection : body.length;

  const beforeInsert = body.slice(0, insertPos).trimEnd();
  const afterInsert = body.slice(insertPos);

  return `${beforeInsert}\n- [ ] ${text}\n${afterInsert}`;
}

/**
 * Find a matching unchecked question (case-insensitive substring) and resolve it.
 * Returns the updated body string, or null if no match found.
 */
function resolveQuestionInBody(body, text, resolution) {
  const lines = body.split('\n');
  const searchLower = text.toLowerCase();

  const matchIdx = lines.findIndex(
    (line) => line.match(/^- \[ \]/) && line.toLowerCase().includes(searchLower)
  );

  if (matchIdx === -1) return null;

  const originalText = lines[matchIdx].replace(/^- \[ \]\s*/, '');
  lines[matchIdx] = `- [x] ${originalText} — Resolved: ${resolution}`;

  return lines.join('\n');
}

async function handler(args, vaultOverride) {
  const { project_path, action, text, resolution } = args;

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

  const { frontmatter, body } = extractFrontmatter(fileContent);

  let newBody;

  if (action === 'add') {
    newBody = addQuestionToBody(body, text);
  } else {
    // resolve
    newBody = resolveQuestionInBody(body, text, resolution);
    if (newBody === null) {
      return {
        content: [{ type: 'text', text: `No matching open question found for: "${text}"` }],
        isError: true
      };
    }
  }

  // Bump updated in frontmatter
  const today = todayDateStr();
  const updatedFrontmatter = { ...frontmatter, updated: today };

  // Rebuild with both new frontmatter AND new body
  const yamlStr = stringifyYaml(updatedFrontmatter).trimEnd();
  const finalContent = `---\n${yamlStr}\n---\n${newBody}`;

  writeFile(filePath, finalContent);

  // Append changelog entry via shared formatter.
  const noteText = action === 'add'
    ? `Added open question: "${text}"`
    : `Resolved open question matching "${text}": ${resolution}`;
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
        description: 'The question text (for add) or a substring to match the question (for resolve).'
      },
      resolution: {
        type: 'string',
        description: 'Required for resolve: the resolution text appended to the question.'
      }
    },
    required: ['project_path', 'action', 'text']
  },
  handler
};

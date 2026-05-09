'use strict';

const path = require('node:path');
const { getVaultPath, resolveInsideVault, VaultPathError } = require('../lib/vault-path.js');
const { readFile, writeFile } = require('../lib/file-ops.js');
const { extractFrontmatter, stringifyYaml } = require('../lib/yaml.js');

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function insertEntryIntoBody(body, entry_title, section) {
  const newEntry = `- [[${entry_title}]]`;

  if (!section) {
    // Append to end of body
    return body.trimEnd() + '\n' + newEntry + '\n';
  }

  const sectionHeader = `## ${section}`;
  const lines = body.split('\n');
  let sectionLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === sectionHeader) {
      sectionLineIdx = i;
      break;
    }
  }

  if (sectionLineIdx === -1) {
    // Section not found — append new section and entry at end
    return body.trimEnd() + '\n\n' + sectionHeader + '\n' + newEntry + '\n';
  }

  // Find the end of this section (next ## heading or end of lines)
  let insertBeforeLine = lines.length;
  for (let i = sectionLineIdx + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) {
      insertBeforeLine = i;
      break;
    }
  }

  // Insert just before the next heading (or at end if no next heading)
  lines.splice(insertBeforeLine, 0, newEntry);
  return lines.join('\n');
}

async function handler(args, vaultOverride) {
  const { moc_path, entry_title, section } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  let fullPath;
  try {
    fullPath = resolveInsideVault(vault, moc_path);
  } catch (err) {
    if (err instanceof VaultPathError) {
      return {
        content: [{ type: 'text', text: `Invalid moc_path: ${err.message}` }],
        isError: true
      };
    }
    throw err;
  }
  const content = readFile(fullPath);
  if (content === null) {
    return {
      content: [{ type: 'text', text: `MOC file not found: ${moc_path}` }],
      isError: true
    };
  }

  const { frontmatter, body } = extractFrontmatter(content);

  const newBody = insertEntryIntoBody(body, entry_title, section);

  // Bump updated in frontmatter
  const updatedFrontmatter = frontmatter
    ? { ...frontmatter, updated: todayISO() }
    : { updated: todayISO() };

  const yamlStr = stringifyYaml(updatedFrontmatter).trimEnd();
  const finalContent = `---\n${yamlStr}\n---\n${newBody}`;

  writeFile(fullPath, finalContent);

  return {
    content: [{ type: 'text', text: `Added [[${entry_title}]] to ${moc_path}` }]
  };
}

module.exports = {
  name: 'update_moc',
  description: 'Add an entry to an MOC file, optionally under a specific section heading, and bump the updated date.',
  inputSchema: {
    type: 'object',
    properties: {
      moc_path: {
        type: 'string',
        description: 'Relative vault path to the MOC file (e.g. Work/TBL/Client/Project/_MOC.md).'
      },
      entry_title: {
        type: 'string',
        description: 'The note title to add as a wikilink entry.'
      },
      section: {
        type: 'string',
        description: 'Optional ## section heading under which to insert the entry.'
      }
    },
    required: ['moc_path', 'entry_title']
  },
  handler
};

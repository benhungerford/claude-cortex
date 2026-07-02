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

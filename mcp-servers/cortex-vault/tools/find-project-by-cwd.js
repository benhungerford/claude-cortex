'use strict';

const path = require('node:path');
const { getVaultPath } = require('../lib/vault-path.js');
const { readFile } = require('../lib/file-ops.js');

async function handler(args, vaultOverride) {
  const { cwd } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const registryPath = path.join(vault, '_repo_registry.json');
  const raw = readFile(registryPath);
  if (raw === null) {
    return {
      content: [{ type: 'text', text: JSON.stringify(null) }]
    };
  }

  let registry;
  try {
    registry = JSON.parse(raw);
  } catch {
    return {
      content: [{ type: 'text', text: 'Failed to parse _repo_registry.json.' }],
      isError: true
    };
  }

  if (!Array.isArray(registry)) {
    return {
      content: [{ type: 'text', text: JSON.stringify(null) }]
    };
  }

  // Normalize cwd to ensure consistent path separators
  const normalizedCwd = path.normalize(cwd);

  // Walk up from cwd, checking each directory against registry entries
  let current = normalizedCwd;
  while (true) {
    const match = registry.find(
      (entry) => path.normalize(entry.repo_path) === current
    );
    if (match) {
      return {
        content: [{ type: 'text', text: JSON.stringify(match, null, 2) }]
      };
    }

    const parent = path.dirname(current);
    if (parent === current) {
      // Reached filesystem root without a match
      break;
    }
    current = parent;
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(null) }]
  };
}

module.exports = {
  name: 'find_project_by_cwd',
  description: 'Find a registered project by walking up from the current working directory.',
  inputSchema: {
    type: 'object',
    properties: {
      cwd: {
        type: 'string',
        description: 'Absolute path to the current working directory.'
      }
    },
    required: ['cwd']
  },
  handler
};

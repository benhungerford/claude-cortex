'use strict';

const { getVaultPath } = require('../lib/vault-path.js');
const { loadRegistry, findProjectByCwd } = require('../lib/registry.js');

async function handler(args, vaultOverride) {
  const { cwd } = args;

  if (typeof cwd !== 'string' || cwd.length === 0) {
    return {
      content: [{ type: 'text', text: 'cwd is required (non-empty string).' }],
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

  let registry;
  try {
    registry = loadRegistry(vault);
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Failed to parse registry: ${err.message}` }],
      isError: true
    };
  }

  const match = findProjectByCwd(registry, cwd);
  return {
    content: [{ type: 'text', text: JSON.stringify(match, null, 2) }]
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

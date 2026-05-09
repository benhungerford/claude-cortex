'use strict';

const path = require('node:path');
const { getVaultPath } = require('../lib/vault-path.js');
const { appendFile } = require('../lib/file-ops.js');
const { VALID_ACTIONS, formatChangelogEntry } = require('../lib/changelog-format.js');

async function handler(args, vaultOverride) {
  const { action, file, dest, note, automated = false } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  let entry;
  try {
    entry = formatChangelogEntry({ action, file, dest, note, automated });
  } catch (err) {
    return {
      content: [{ type: 'text', text: err.message }],
      isError: true
    };
  }

  const changelogPath = path.join(vault, '_changelog.txt');
  appendFile(changelogPath, entry);

  return {
    content: [{ type: 'text', text: entry }]
  };
}

module.exports = {
  name: 'append_changelog',
  description: 'Append a validated entry to the vault _changelog.txt audit log.',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: VALID_ACTIONS,
        description: 'The action type to log.'
      },
      file: {
        type: 'string',
        description: 'Filename (not full path) of the file being acted on.'
      },
      dest: {
        type: 'string',
        description: 'Relative vault path destination.'
      },
      note: {
        type: 'string',
        description: 'Human-readable context for the log entry.'
      },
      automated: {
        type: 'boolean',
        description: 'If true, tag the entry as [auto] (hook-driven, not skill-captured). Defaults to false.',
        default: false
      }
    },
    required: ['action', 'file', 'dest', 'note']
  },
  handler
};

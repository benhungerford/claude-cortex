'use strict';

const path = require('node:path');
const { getVaultPath } = require('../lib/vault-path.js');
const { appendFile } = require('../lib/file-ops.js');

const VALID_ACTIONS = [
  'CREATED', 'MOVED', 'RENAMED', 'TAGGED', 'UPDATED', 'LINKED',
  'PULLED', 'ARCHIVED', 'SKIPPED', 'UNKNOWN', 'MEMORY_UPDATED',
  'MOC_UPDATED', 'STATUS_CHANGED'
];

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}

async function handler(args, vaultOverride) {
  const { action, file, dest, note } = args;

  if (!VALID_ACTIONS.includes(action)) {
    return {
      content: [{
        type: 'text',
        text: `Invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}`
      }],
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

  const timestamp = formatTimestamp(new Date());
  const entry = `[${timestamp}] ${action} | FILE: ${file} | DEST: ${dest} | NOTE: ${note}`;

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
      }
    },
    required: ['action', 'file', 'dest', 'note']
  },
  handler
};

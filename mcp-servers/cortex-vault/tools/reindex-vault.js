'use strict';

const { getVaultPath } = require('../lib/vault-path.js');
const { indexVault } = require('../lib/indexer.js');

async function handler(args, vaultOverride) {
  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const result = await indexVault(vault);

  const summary = {
    vault,
    indexed: result.indexed,
    skipped: result.skipped,
    removed: result.removed,
    elapsed_ms: result.elapsed_ms,
    elapsed_human: `${(result.elapsed_ms / 1000).toFixed(1)}s`
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
  };
}

module.exports = {
  name: 'reindex_vault',
  description:
    'Rebuild the semantic search index for the entire vault. New and changed notes are embedded; unchanged notes are skipped; deleted notes are removed from the index. Safe to call repeatedly.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  handler
};

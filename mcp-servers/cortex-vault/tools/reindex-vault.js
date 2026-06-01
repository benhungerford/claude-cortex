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

  // W2.2 — stream progress to stderr so a large rebuild isn't silent. MCP
  // stdout is the protocol channel, so progress must go to stderr only.
  let n = 0;
  const result = await indexVault(vault, {
    onProgress: ({ file, status }) => {
      n += 1;
      if (status === 'indexed' && (n <= 5 || n % 25 === 0)) {
        process.stderr.write(`[cortex-vault] reindex: ${n} processed (latest: ${file})\n`);
      }
    }
  });

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

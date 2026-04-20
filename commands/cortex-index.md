---
description: Rebuild the semantic search index over the entire vault. Embeds new and changed notes, skips unchanged ones, removes deleted ones. Safe to run repeatedly. Usage:/cortex-index. Takes no arguments.
---

# /cortex-index

Rebuild Cortex's semantic search index by calling the `reindex_vault` MCP tool.

**Arguments:** none.

**Procedure:**
1. Call the `reindex_vault` tool from the `cortex-vault` MCP server.
2. Report the result to the user in a single concise line:
   - `Indexed N, skipped M, removed K in X.Xs.`
3. If `indexed + removed > 0`, also note: "Semantic search is now up to date."
4. If the tool returns an error (e.g. vault path not configured), relay the error and suggest running `/cortex-onboard` if the vault hasn't been set up yet.

**Expected runtime:** the first run on a fresh vault can take ~30–90 seconds depending on vault size; subsequent runs finish in under a second when nothing has changed.

**Notes:**
- The index lives at `{vault}/.cortex/search.db`. It is safe to delete; the next `/cortex-index` run will rebuild it.
- This command is normally unnecessary because the `post-tool-use` hook re-indexes notes on save. Use it after a bulk move, restore from backup, or when the DB has been deleted.

**Related:** `mcp-servers/cortex-vault/tools/reindex-vault.js` · `mcp-servers/cortex-vault/lib/indexer.js`

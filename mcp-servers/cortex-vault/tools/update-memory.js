'use strict';

// update_memory — the real long-term memory write path (W2.7 / T13).
//
// Background: the stop hook flushes <plugin-data>/session-cache/pending-memory.json
// into <vault>/memory.md, but nothing in the repo ever *produced* that queue file,
// so the global memory.md accumulation path was inert. This tool is the producer:
// it appends a durable fact straight into memory.md so a stated client preference
// (the canonical Tier-1 client-preference capture type) survives across sessions on
// every platform — not just the ones with a working bash+python3 stop hook.
//
// Guarantees:
//   - Verbatim-line dedup (whitespace-insensitive) so the same fact isn't restated.
//   - Optional `section` arg groups facts under a `## <section>` header, reused if
//     it already exists rather than duplicated.
//   - An eviction/compaction notice once memory.md grows past a soft line cap
//     (~80 lines), so old facts are never silently dropped without a signal.
//     (Compaction itself is /cortex-compact-memory; this only warns.)

const path = require('node:path');
const { getVaultPath } = require('../lib/vault-path.js');
const { readFile, writeFile } = require('../lib/file-ops.js');

// Soft cap on memory.md size. Past this we surface a one-line eviction notice
// nudging the user toward /cortex-compact-memory. We do NOT auto-truncate here —
// silent drops are exactly the failure mode T13 flagged.
const SOFT_LINE_CAP = 80;

function normalizeLine(s) {
  return String(s).trim().replace(/\s+/g, ' ');
}

async function handler(args, vaultOverride) {
  const { content, section } = args || {};

  const vault = vaultOverride !== undefined ? vaultOverride : getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const fact = typeof content === 'string' ? content.trim() : '';
  if (!fact) {
    return {
      content: [{ type: 'text', text: 'No content provided — `content` must be a non-empty string.' }],
      isError: true
    };
  }

  const memoryPath = path.join(vault, 'memory.md');
  let existing = readFile(memoryPath);
  if (existing === null) {
    existing = '# Memory\n';
  }

  // ── Dedup: verbatim line match, whitespace-insensitive ────────────────────
  const factNorm = normalizeLine(fact);
  const existingLines = existing.split('\n');
  const alreadyPresent = existingLines.some((l) => normalizeLine(l) === factNorm);
  if (alreadyPresent) {
    return {
      content: [{
        type: 'text',
        text: `Already in memory.md (duplicate line skipped): ${fact}`
      }]
    };
  }

  // ── Assemble the new content ──────────────────────────────────────────────
  let updated;
  if (section) {
    const header = `## ${section.trim()}`;
    // Reuse an existing identical header rather than duplicating it.
    const headerIdx = existingLines.findIndex((l) => l.trim() === header);
    if (headerIdx === -1) {
      // New section: append header + fact at the end.
      const base = existing.endsWith('\n') ? existing : existing + '\n';
      updated = `${base}\n${header}\n${fact}\n`;
    } else {
      // Insert the fact after the existing header (and after any blank line
      // immediately following it) so it lands inside the section.
      let insertAt = headerIdx + 1;
      const out = existingLines.slice();
      out.splice(insertAt, 0, fact);
      updated = out.join('\n');
      if (!updated.endsWith('\n')) updated += '\n';
    }
  } else {
    const base = existing.endsWith('\n') ? existing : existing + '\n';
    updated = `${base}${fact}\n`;
  }

  writeFile(memoryPath, updated);

  // ── Eviction notice past the soft cap ─────────────────────────────────────
  const lineCount = updated.split('\n').filter((l) => l.length > 0).length;
  let text = `Saved to memory.md: ${fact}`;
  if (lineCount > SOFT_LINE_CAP) {
    text += ` — Note: memory.md now has ${lineCount} lines (soft cap ${SOFT_LINE_CAP}); run /cortex-compact-memory to evict stale facts before they crowd boot context.`;
  }

  return {
    content: [{ type: 'text', text }]
  };
}

module.exports = {
  name: 'update_memory',
  description:
    'Append a durable fact to the vault long-term memory (memory.md). Use for ' +
    'cross-project facts that should survive every session — most commonly a ' +
    'Tier-1 client preference. Dedups verbatim lines, groups facts under an ' +
    'optional section header, and warns when memory.md grows past its soft cap.',
  inputSchema: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The fact to remember, as a single line (e.g. "Acme prefers Tailwind over Bootstrap").'
      },
      section: {
        type: 'string',
        description: 'Optional `## section` header to group the fact under (e.g. "Client Preferences"). Reused if it already exists.'
      }
    },
    required: ['content']
  },
  handler
};

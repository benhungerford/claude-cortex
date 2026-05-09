'use strict';

// Single source of truth for vault changelog format.
//
// All writers — MCP tools, the post-tool-use hook, reindex-one — produce
// entries via formatChangelogEntry so the line shape stays in lockstep.
// Drift here breaks downstream parsers (boot-context.py recent_activity,
// check-dormant-features session counter, the cortex-status read flow).

const VALID_ACTIONS = [
  'CREATED', 'MOVED', 'RENAMED', 'TAGGED', 'UPDATED', 'LINKED',
  'PULLED', 'ARCHIVED', 'SKIPPED', 'UNKNOWN', 'MEMORY_UPDATED',
  'MOC_UPDATED', 'STATUS_CHANGED', 'INDEX_FAILED'
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatTimestamp(date) {
  return (
    `${date.getFullYear()}-` +
    `${pad2(date.getMonth() + 1)}-` +
    `${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:` +
    `${pad2(date.getMinutes())}`
  );
}

// Build a single changelog line. The trailing newline is the caller's
// responsibility (appendFile adds one if missing).
//
// {action, file, dest, note, automated?} — automated=true tags the entry
// as `[auto]` so humans can distinguish hook-driven entries from skill
// captures.
function formatChangelogEntry({ action, file, dest, note, automated = false, timestamp = new Date() }) {
  if (!VALID_ACTIONS.includes(action)) {
    throw new Error(`Invalid changelog action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}`);
  }
  const tag = automated ? ' [auto]' : '';
  return `[${formatTimestamp(timestamp)}] ${action}${tag} | FILE: ${file} | DEST: ${dest} | NOTE: ${note}`;
}

module.exports = {
  VALID_ACTIONS,
  formatTimestamp,
  formatChangelogEntry
};

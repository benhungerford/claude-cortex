'use strict';

// Canonical hub "Open Questions & Blockers" schema.
//
// One representation, shared by every code path that reads or writes a project
// hub: read_hub, open_question, scaffold_project (JS) and boot-context.py's
// parse_hub (Python, kept in lockstep via references/hub-schema.md).
//
// Format is a Markdown pipe-table under a fixed heading:
//
//   ## Open Questions & Blockers
//   | # | Question / Blocker | Type | Owner | Status |
//   |---|-------------------|------|-------|--------|
//   | 1 | ...               | ...  | ...   | Open   |
//
// Classification (mirrors boot-context.py parse_hub): a row whose Type is
// Dependency / Internal / Unknown is a BLOCKER; anything else is an OPEN
// QUESTION. Rows with an empty Question or Status == "Resolved" are skipped by
// readers; resolving a row removes it entirely (never strikethrough).

const HUB_SECTION = '## Open Questions & Blockers';
const TABLE_HEADER = '| # | Question / Blocker | Type | Owner | Status |';
const TABLE_DIVIDER = '|---|-------------------|------|-------|--------|';
const BLOCKER_TYPES = new Set(['Dependency', 'Internal', 'Unknown']);

function emptyTable() {
  return `${HUB_SECTION}\n${TABLE_HEADER}\n${TABLE_DIVIDER}\n| 1 | | | | Open |\n`;
}

function splitCells(line) {
  // "| a | b |" => ["a", "b"]
  return line.split('|').slice(1, -1).map((c) => c.trim());
}

function isDataRow(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return false;
  if (/^\|[\s|:-]+\|?$/.test(t)) return false; // divider row
  const cells = splitCells(t);
  if (cells.length < 5) return false;
  // header row
  if (cells[0] === '#' && /question/i.test(cells[1])) return false;
  return true;
}

// Extract the raw body of the Open Questions & Blockers section.
function sectionLines(content) {
  const lines = content.split('\n');
  const out = [];
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.trim() === HUB_SECTION) { inSection = true; continue; }
    } else if (inSection) {
      out.push(line);
    }
  }
  return out;
}

function parseQuestionBlockerRows(content) {
  return sectionLines(content)
    .filter(isDataRow)
    .map((line) => {
      const [num, question, type, owner, status] = splitCells(line);
      return { num, question, type, owner, status };
    })
    .filter((r) => r.question !== ''); // drop the placeholder blank row
}

function classifyRows(rows) {
  const openQuestions = [];
  const blockers = [];
  for (const r of rows) {
    if (!r.question) continue;
    if ((r.status || '').toLowerCase() === 'resolved') continue;
    if (BLOCKER_TYPES.has(r.type)) blockers.push(r.question);
    else openQuestions.push(r.question);
  }
  return { openQuestions, blockers };
}

function serializeRow({ num, question, type, owner, status }) {
  return `| ${num} | ${question || ''} | ${type || ''} | ${owner || ''} | ${status || 'Open'} |`;
}

// Insert the section (with header + divider) before the footer or at end.
function insertSection(content, rowLine) {
  const block = `${HUB_SECTION}\n${TABLE_HEADER}\n${TABLE_DIVIDER}\n${rowLine}\n`;
  const footerIdx = content.lastIndexOf('\n---\n');
  if (footerIdx !== -1) {
    return content.slice(0, footerIdx) + `\n\n${block}` + content.slice(footerIdx + 1);
  }
  return `${content.trimEnd()}\n\n${block}`;
}

function addRow(content, { question, type = 'Question', owner = '' }) {
  const lines = content.split('\n');
  // Locate section bounds
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === HUB_SECTION) { start = i; break; }
  }
  if (start === -1) {
    const rows = parseQuestionBlockerRows(content);
    const nextNum = String(rows.length + 1);
    return insertSection(content, serializeRow({ num: nextNum, question, type, owner, status: 'Open' }));
  }

  // Find end of section
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }

  const existing = parseQuestionBlockerRows(content);
  const nextNum = String(existing.length + 1);
  const newRow = serializeRow({ num: nextNum, question, type, owner, status: 'Open' });

  // Drop the placeholder blank row if present; find last data/divider line index.
  let insertAt = end;
  // Walk back over trailing blank lines to keep table contiguous.
  let j = end - 1;
  while (j > start && lines[j].trim() === '') j--;
  insertAt = j + 1;

  // Remove an existing placeholder blank row ("| n | | | | Open |")
  for (let i = start + 1; i <= j; i++) {
    if (isDataRow(lines[i])) {
      const cells = splitCells(lines[i]);
      if (cells[1] === '') { lines.splice(i, 1); j--; insertAt--; break; }
    }
  }

  lines.splice(insertAt, 0, newRow);
  return lines.join('\n');
}

function resolveRow(content, text) {
  const lines = content.split('\n');
  const searchLower = text.toLowerCase();
  const matches = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isDataRow(lines[i])) continue;
    const cells = splitCells(lines[i]);
    const question = cells[1];
    if (question && question.toLowerCase().includes(searchLower)) {
      matches.push({ idx: i, question });
    }
  }
  if (matches.length === 0) return { notFound: true };
  if (matches.length > 1) {
    return { error: 'ambiguous', candidates: matches.map((m) => m.question) };
  }
  const { idx, question } = matches[0];
  lines.splice(idx, 1);
  return { content: lines.join('\n'), removed: question };
}

// ── Legacy migration ────────────────────────────────────────────────────────
// Old hubs (and the old scaffold) used "## Open Questions" + "## Blockers"
// checkbox lists. Convert them to the canonical pipe-table.

// Remove a "## <name>" section; return { body, items } where items are the
// raw checkbox item strings found inside it.
function spliceSection(body, name) {
  const lines = body.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === `## ${name}`) { start = i; break; }
  }
  if (start === -1) return { body, items: [] };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  const items = [];
  for (let i = start + 1; i < end; i++) {
    const m = lines[i].match(/^- \[([ xX])\]\s*(.*)$/);
    if (m) items.push({ checked: m[1].toLowerCase() === 'x', text: m[2].trim() });
  }
  lines.splice(start, end - start);
  return { body: lines.join('\n'), items };
}

function legacyItemToRow(item, defaultType, num) {
  let question = item.text;
  let status = item.checked ? 'Resolved' : 'Open';
  const resolvedSplit = question.split(/\s+—\s+Resolved:/);
  if (resolvedSplit.length > 1) {
    question = resolvedSplit[0].trim();
    status = 'Resolved';
  }
  return { num: String(num), question, type: defaultType, owner: '', status };
}

function migrateBodyToCanonical(body) {
  if (body.includes(HUB_SECTION)) return { body, changed: false };

  let working = body;
  const oq = spliceSection(working, 'Open Questions');
  working = oq.body;
  const bl = spliceSection(working, 'Blockers');
  working = bl.body;

  if (oq.items.length === 0 && bl.items.length === 0) {
    // Nothing legacy to migrate and no canonical section: add an empty table.
    return { body: insertSection(working, '| 1 | | | | Open |'), changed: working !== body || true };
  }

  let n = 0;
  const rows = [
    ...oq.items.map((it) => legacyItemToRow(it, 'Question', ++n)),
    ...bl.items.map((it) => legacyItemToRow(it, 'Dependency', ++n)),
  ];
  const rowLines = rows.map(serializeRow).join('\n');
  const withSection = insertSection(working, rowLines);
  return { body: withSection, changed: true };
}

module.exports = {
  HUB_SECTION,
  TABLE_HEADER,
  TABLE_DIVIDER,
  BLOCKER_TYPES,
  emptyTable,
  parseQuestionBlockerRows,
  classifyRows,
  serializeRow,
  addRow,
  resolveRow,
  migrateBodyToCanonical,
};

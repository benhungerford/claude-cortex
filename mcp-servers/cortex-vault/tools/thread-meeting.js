'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { getVaultPath } = require('../lib/vault-path.js');
const { readFile, writeFile } = require('../lib/file-ops.js');

// Match YYYY-MM-DD <Title>.md
const DATE_PREFIX_RE = /^(\d{4}-\d{2}-\d{2}) (.+)\.md$/;

function parseMeetingFile(filename) {
  const m = filename.match(DATE_PREFIX_RE);
  if (!m) return null;
  return { date: m[1], title: m[2], filename };
}

function listMeetingFiles(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return [];
  }
  return entries
    .map(parseMeetingFile)
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Remove the .md extension to get the note title for wikilinks
function noteTitle(filename) {
  return filename.endsWith('.md') ? filename.slice(0, -3) : filename;
}

/**
 * Insert or update the *Previous:* line in a note's footer.
 * Footer is the block after the last `---` separator in the body.
 *
 * Rules:
 * - If a `*Previous:*` line already exists, leave it unchanged
 *   (it already points to its own predecessor).
 * - If no `*Previous:*` line, prepend it before `*Related:*` if that exists,
 *   otherwise prepend before the last `---` separator.
 */
function addPreviousLink(content, previousTitle) {
  const link = `*Previous:* [[${previousTitle}]]`;
  const lines = content.split('\n');

  // Check if *Previous:* already exists
  if (lines.some(l => l.trim().startsWith('*Previous:*'))) {
    return content; // already has one — don't touch it
  }

  // Find index of *Related:* line
  const relatedIdx = lines.findIndex(l => l.trim().startsWith('*Related:*'));
  if (relatedIdx !== -1) {
    lines.splice(relatedIdx, 0, link);
    return lines.join('\n');
  }

  // No *Related:* — find last `---` separator and insert after it
  let lastSepIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '---') {
      lastSepIdx = i;
      break;
    }
  }
  if (lastSepIdx !== -1) {
    lines.splice(lastSepIdx + 1, 0, link);
    return lines.join('\n');
  }

  // Fallback: append at end
  return content.trimEnd() + '\n' + link + '\n';
}

/**
 * Insert or update the *Next:* link in the prior note's footer.
 *
 * Rules:
 * - If the prior note's `*Previous:*` line already contains `*Next:*`
 *   (e.g. "Previous: X · Next: Y"), replace the Next: portion.
 * - If the prior note has a `*Previous:*` line without `*Next:*`, append it.
 * - If no `*Previous:*` line, add `*Next:* [[...]]` before *Related:* or at end of footer.
 */
function addNextLink(content, nextTitle) {
  const nextFragment = `*Next:* [[${nextTitle}]]`;
  const lines = content.split('\n');

  // Find a line that starts with *Previous:*
  const prevLineIdx = lines.findIndex(l => l.trim().startsWith('*Previous:*'));

  if (prevLineIdx !== -1) {
    const prevLine = lines[prevLineIdx];
    if (prevLine.includes('*Next:*')) {
      // Replace existing Next: link
      lines[prevLineIdx] = prevLine.replace(/\*Next:\*\s*\[\[[^\]]+\]\]/, nextFragment);
    } else {
      // Append to the end of the Previous: line
      lines[prevLineIdx] = prevLine.trimEnd() + ' · ' + nextFragment;
    }
    return lines.join('\n');
  }

  // No *Previous:* line — add standalone *Next:* before *Related:* or at end of footer
  // Find last `---` separator
  let lastSepIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim() === '---') {
      lastSepIdx = i;
      break;
    }
  }

  const relatedIdx = lines.findIndex(l => l.trim().startsWith('*Related:*'));
  if (relatedIdx !== -1) {
    lines.splice(relatedIdx, 0, nextFragment);
    return lines.join('\n');
  }

  if (lastSepIdx !== -1) {
    lines.splice(lastSepIdx + 1, 0, nextFragment);
    return lines.join('\n');
  }

  return content.trimEnd() + '\n' + nextFragment + '\n';
}

async function handler(args, vaultOverride) {
  const { notes_dir, new_file } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const notesDirAbs = path.isAbsolute(notes_dir)
    ? notes_dir
    : path.join(vault, notes_dir);

  // Parse the new file
  const newParsed = parseMeetingFile(new_file);
  if (!newParsed) {
    return {
      content: [{
        type: 'text',
        text: `"${new_file}" does not match YYYY-MM-DD Title.md format — cannot thread.`
      }]
    };
  }

  // List all meeting files in the directory
  const allMeetings = listMeetingFiles(notesDirAbs);

  // Group by title suffix
  const groups = {};
  for (const m of allMeetings) {
    if (!groups[m.title]) groups[m.title] = [];
    groups[m.title].push(m);
  }

  // Ensure the new file is included in the count
  // (it may already be on disk, or it may need to be counted as the 3rd)
  const titleGroup = groups[newParsed.title] || [];

  // If the new file is not already in the list (not yet on disk), add it
  const alreadyInGroup = titleGroup.some(m => m.filename === new_file);
  let effectiveGroup = titleGroup;
  if (!alreadyInGroup) {
    effectiveGroup = [...titleGroup, newParsed].sort((a, b) => a.date.localeCompare(b.date));
  }

  if (effectiveGroup.length < 3) {
    return {
      content: [{
        type: 'text',
        text: `Series "${newParsed.title}" has ${effectiveGroup.length} note(s) — need at least 3 to thread. Skipping.`
      }]
    };
  }

  // Find the most recent prior note (the one just before the new file in sorted order)
  const newIdx = effectiveGroup.findIndex(m => m.filename === new_file);
  if (newIdx === 0) {
    return {
      content: [{
        type: 'text',
        text: `"${new_file}" is the earliest in the series — nothing to thread backwards.`
      }]
    };
  }

  const priorMeeting = effectiveGroup[newIdx - 1];
  const newTitle = noteTitle(new_file);
  const priorTitle = noteTitle(priorMeeting.filename);

  // Update new note: add *Previous:* link
  const newFilePath = path.join(notesDirAbs, new_file);
  const newContent = readFile(newFilePath);
  if (newContent === null) {
    return {
      content: [{
        type: 'text',
        text: `New file not found on disk: ${new_file} — create it first, then call thread_meeting.`
      }],
      isError: true
    };
  }

  const updatedNewContent = addPreviousLink(newContent, priorTitle);
  if (updatedNewContent !== newContent) {
    writeFile(newFilePath, updatedNewContent);
  }

  // Update prior note: add *Next:* link
  const priorFilePath = path.join(notesDirAbs, priorMeeting.filename);
  const priorContent = readFile(priorFilePath);
  if (priorContent === null) {
    return {
      content: [{
        type: 'text',
        text: `Prior file not found: ${priorMeeting.filename}`
      }],
      isError: true
    };
  }

  const updatedPriorContent = addNextLink(priorContent, newTitle);
  if (updatedPriorContent !== priorContent) {
    writeFile(priorFilePath, updatedPriorContent);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        threaded: true,
        new_file: new_file,
        previous: priorMeeting.filename,
        series: newParsed.title,
        series_count: effectiveGroup.length
      }, null, 2)
    }]
  };
}

module.exports = {
  name: 'thread_meeting',
  description: 'Detect a recurring meeting series by title suffix and add *Previous:*/*Next:* thread links between the new meeting note and its predecessor.',
  inputSchema: {
    type: 'object',
    properties: {
      notes_dir: {
        type: 'string',
        description: 'Relative vault path to the Notes directory containing meeting files (e.g. Work/TBL/Client/Project/Notes).'
      },
      new_file: {
        type: 'string',
        description: 'Filename of the newly added meeting note (e.g. "2026-03-22 Client Check-in.md"). Must follow YYYY-MM-DD Title.md format.'
      }
    },
    required: ['notes_dir', 'new_file']
  },
  handler
};

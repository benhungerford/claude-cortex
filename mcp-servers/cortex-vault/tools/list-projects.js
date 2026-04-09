'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { getVaultPath } = require('../lib/vault-path.js');
const { readFile } = require('../lib/file-ops.js');
const { extractFrontmatter } = require('../lib/yaml.js');

/**
 * Walk Work/ tree and collect all Project Context files.
 */
function findProjectContextFiles(vaultPath) {
  const workDir = path.join(vaultPath, 'Work');
  const results = [];

  function walk(dir, relDir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(relDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(' \u2014 Project Context.md') || entry.name.endsWith(' — Project Context.md'))
      ) {
        results.push({ fullPath, relPath, dirPath: dir, dirRel: relDir });
      }
    }
  }

  walk(workDir, 'Work');
  return results;
}

/**
 * Extract section content from markdown body (stops at next ## heading).
 */
function extractSection(body, sectionName) {
  const lines = body.split('\n');
  let inSection = false;
  const sectionLines = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break;
      if (line.trim() === `## ${sectionName}`) {
        inSection = true;
        continue;
      }
    } else if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n');
}

/**
 * Count unchecked items in a section.
 */
function countUnchecked(body, sectionName) {
  const sectionContent = extractSection(body, sectionName);
  if (!sectionContent) return 0;
  return (sectionContent.match(/^- \[ \]/gm) || []).length;
}

const STATUS_ORDER = ['Active Build', 'Planning', 'Ongoing Support', 'Paused', 'Archived'];

async function handler(args, vaultOverride) {
  const { status_filter } = args || {};

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const files = findProjectContextFiles(vault);
  const projects = [];

  for (const { fullPath, dirRel } of files) {
    const content = readFile(fullPath);
    if (!content) continue;

    const { frontmatter, body } = extractFrontmatter(content);
    if (!frontmatter) continue;

    const status = frontmatter.status || null;

    // Apply status filter if provided
    if (status_filter && status !== status_filter) continue;

    projects.push({
      project: frontmatter.project || null,
      client: frontmatter.client || null,
      status,
      updated: frontmatter.updated || null,
      launch: frontmatter.launch || null,
      open_questions: countUnchecked(body, 'Open Questions'),
      blockers: countUnchecked(body, 'Blockers'),
      path: dirRel
    });
  }

  // Sort: Active Build first, then by status order, then by updated descending
  projects.sort((a, b) => {
    const aIdx = STATUS_ORDER.indexOf(a.status ?? '');
    const bIdx = STATUS_ORDER.indexOf(b.status ?? '');
    const aOrder = aIdx === -1 ? STATUS_ORDER.length : aIdx;
    const bOrder = bIdx === -1 ? STATUS_ORDER.length : bIdx;

    if (aOrder !== bOrder) return aOrder - bOrder;

    // Same status tier — sort by updated descending
    const aDate = a.updated ? String(a.updated) : '';
    const bDate = b.updated ? String(b.updated) : '';
    if (aDate > bDate) return -1;
    if (aDate < bDate) return 1;
    return 0;
  });

  return {
    content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }]
  };
}

module.exports = {
  name: 'list_projects',
  description: 'Walk the Work/ directory tree and return a summary of all projects found, with status, open question counts, and blocker counts.',
  inputSchema: {
    type: 'object',
    properties: {
      status_filter: {
        type: 'string',
        description: 'Optional status to filter by (e.g. "Active Build", "Paused").'
      }
    },
    required: []
  },
  handler
};

'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { getVaultPath } = require('../lib/vault-path.js');
const { readFile } = require('../lib/file-ops.js');
const { extractFrontmatter } = require('../lib/yaml.js');

/**
 * Parse the dormant section from personality.md.
 * The format is:
 *   ### dormant
 *   - feature_name
 *     signal: <signal text>
 */
function parseDormantFeatures(content) {
  const { body } = extractFrontmatter(content);
  const lines = body.split('\n');

  let inDormant = false;
  const features = [];
  let currentFeature = null;

  for (const line of lines) {
    if (line.trim() === '### dormant') {
      inDormant = true;
      continue;
    }
    if (inDormant && line.startsWith('###')) {
      // Another subsection — done with dormant
      break;
    }
    if (!inDormant) continue;

    // Feature line: "- feature_name"
    const featureMatch = line.match(/^- (\S+)\s*$/);
    if (featureMatch) {
      if (currentFeature) features.push(currentFeature);
      currentFeature = { feature: featureMatch[1], signal: null };
      continue;
    }

    // Signal line (indented): "  signal: <text>"
    const signalMatch = line.match(/^\s+signal:\s+(.+)$/);
    if (signalMatch && currentFeature) {
      currentFeature.signal = signalMatch[1].trim();
    }
  }

  if (currentFeature) features.push(currentFeature);

  return features;
}

/**
 * Count Project Context files with status "Active Build" under Work/.
 */
function countActiveProjects(vaultPath) {
  const workDir = path.join(vaultPath, 'Work');
  let count = 0;

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(' \u2014 Project Context.md') || entry.name.endsWith(' — Project Context.md'))
      ) {
        const fileContent = readFile(fullPath);
        if (fileContent) {
          const { frontmatter } = extractFrontmatter(fileContent);
          if (frontmatter && frontmatter.status === 'Active Build') {
            count++;
          }
        }
      }
    }
  }

  walk(workDir);
  return count;
}

/**
 * Count unique dates in _changelog.txt within the last 7 days.
 */
function countRecentSessionDates(vaultPath) {
  const changelogPath = path.join(vaultPath, '_changelog.txt');
  const content = readFile(changelogPath);
  if (!content) return 0;

  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const uniqueDates = new Set();

  for (const line of content.split('\n')) {
    // Lines are formatted: [YYYY-MM-DD HH:MM] ...
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}\]/);
    if (match) {
      const dateStr = match[1];
      const date = new Date(dateStr + 'T00:00:00');
      if (date >= sevenDaysAgo) {
        uniqueDates.add(dateStr);
      }
    }
  }

  return uniqueDates.size;
}

/**
 * Evaluate a signal string and return { met: bool, evidence: string }.
 */
function evaluateSignal(signal, vaultPath) {
  if (signal === '3+ active projects') {
    const count = countActiveProjects(vaultPath);
    return {
      met: count >= 3,
      evidence: `${count} active project(s) found (need 3+)`
    };
  }

  if (signal === '10+ sessions in 7 days') {
    const count = countRecentSessionDates(vaultPath);
    return {
      met: count >= 10,
      evidence: `${count} unique session day(s) in last 7 days (need 10+)`
    };
  }

  return {
    met: false,
    evidence: `Unknown signal: "${signal}"`
  };
}

async function handler(args, vaultOverride) {
  const vault = args.vault_path || vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const personalityPath = path.join(vault, 'personality.md');
  const content = readFile(personalityPath);
  if (!content) {
    return {
      content: [{ type: 'text', text: 'Could not read personality.md.' }],
      isError: true
    };
  }

  const dormantFeatures = parseDormantFeatures(content);

  const ready = [];
  const not_ready = [];

  for (const { feature, signal } of dormantFeatures) {
    if (!signal) {
      not_ready.push({ feature, signal: null, evidence: 'No signal defined' });
      continue;
    }

    const { met, evidence } = evaluateSignal(signal, vault);
    const entry = { feature, signal, evidence };

    if (met) {
      ready.push(entry);
    } else {
      not_ready.push(entry);
    }
  }

  return {
    content: [{ type: 'text', text: JSON.stringify({ ready, not_ready }, null, 2) }]
  };
}

module.exports = {
  name: 'check_dormant_features',
  description: 'Check which dormant progressive features in personality.md are ready to activate based on their signals.',
  inputSchema: {
    type: 'object',
    properties: {
      vault_path: {
        type: 'string',
        description: 'Optional override for the vault path.'
      }
    },
    required: []
  },
  handler
};

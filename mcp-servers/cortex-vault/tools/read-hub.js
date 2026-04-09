'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { getVaultPath } = require('../lib/vault-path.js');
const { readFile } = require('../lib/file-ops.js');
const { extractFrontmatter } = require('../lib/yaml.js');

function findProjectContextFile(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath);
  } catch {
    return null;
  }

  // Match any file ending with " — Project Context.md"
  const match = entries.find(
    (f) => f.endsWith(' \u2014 Project Context.md') || f.endsWith(' — Project Context.md')
  );
  return match || null;
}

function extractSection(body, sectionName) {
  const lines = body.split('\n');
  let inSection = false;
  const sectionLines = [];

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (inSection) break; // reached next section
      if (line.trim() === `## ${sectionName}`) {
        inSection = true;
        continue;
      }
    } else if (inSection) {
      sectionLines.push(line);
    }
  }

  return sectionLines.join('\n').trim();
}

function extractOpenQuestions(body) {
  const sectionContent = extractSection(body, 'Open Questions');
  if (!sectionContent) return [];

  return sectionContent
    .split('\n')
    .filter((line) => line.match(/^- \[ \]/))
    .map((line) => line.replace(/^- \[ \]\s*/, '').trim());
}

async function handler(args, vaultOverride) {
  const { project_path } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const fullDirPath = path.join(vault, project_path);
  const contextFileName = findProjectContextFile(fullDirPath);

  if (!contextFileName) {
    return {
      content: [{ type: 'text', text: `No Project Context file found in: ${project_path}` }],
      isError: true
    };
  }

  const filePath = path.join(fullDirPath, contextFileName);
  const content = readFile(filePath);
  if (content === null) {
    return {
      content: [{ type: 'text', text: `Could not read file: ${contextFileName}` }],
      isError: true
    };
  }

  const { frontmatter, body } = extractFrontmatter(content);

  const result = {
    project: frontmatter?.project || null,
    client: frontmatter?.client || null,
    status: frontmatter?.status || null,
    launch: frontmatter?.launch || null,
    open_questions: extractOpenQuestions(body),
    current_phase: extractSection(body, 'Current Phase') || null,
    key_decisions: extractSection(body, 'Key Decisions') || null,
    file: contextFileName
  };

  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
}

module.exports = {
  name: 'read_hub',
  description: 'Read structured project context data from a project hub file (Project Context.md).',
  inputSchema: {
    type: 'object',
    properties: {
      project_path: {
        type: 'string',
        description: 'Relative vault path to the project folder (e.g. Work/TBL/Client/Project).'
      }
    },
    required: ['project_path']
  },
  handler
};

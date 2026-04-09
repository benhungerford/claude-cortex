'use strict';

const path = require('node:path');
const { getVaultPath } = require('../lib/vault-path.js');
const { writeFile, appendFile, ensureDir, fileExists } = require('../lib/file-ops.js');
const { stringifyYaml } = require('../lib/yaml.js');

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}

function yamlBlock(data) {
  return `---\n${stringifyYaml(data).trimEnd()}\n---\n`;
}

function logEntry(vault, file, dest, note) {
  const timestamp = formatTimestamp(new Date());
  const entry = `[${timestamp}] CREATED | FILE: ${file} | DEST: ${dest} | NOTE: ${note}`;
  appendFile(path.join(vault, '_changelog.txt'), entry);
}

async function handler(args, vaultOverride) {
  const {
    client,
    project,
    category,
    brand,
    status = 'Planning',
    domain,
  } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  const today = todayISO();
  const created = [];

  // Build paths
  // Personal projects: Work/Personal/<client>/<brand>/<project>/
  // TBL projects:      Work/TBL/<client>/<project>/
  let clientRelPath;
  let projectRelPath;

  if (category === 'Personal' && brand) {
    clientRelPath = `Work/Personal/${client}`;
    projectRelPath = `Work/Personal/${client}/${brand}/${project}`;
  } else {
    clientRelPath = `Work/${category}/${client}`;
    projectRelPath = `Work/${category}/${client}/${project}`;
  }

  const clientAbsPath = path.join(vault, clientRelPath);
  const projectAbsPath = path.join(vault, projectRelPath);

  // ------------------------------------------------------------------
  // Create client folder if it doesn't exist
  // ------------------------------------------------------------------
  const clientMocPath = path.join(clientAbsPath, '_MOC.md');
  if (!fileExists(clientMocPath)) {
    ensureDir(clientAbsPath);

    // Client _MOC.md
    const clientMocFm = {
      type: 'client',
      client,
      status: 'Active Project',
      created: today,
      updated: today,
      tags: ['#type/moc', '#type/client'],
    };
    const clientMocContent =
      yamlBlock(clientMocFm) +
      `\n# ${client}\n\n## Projects\n\n## Notes\n`;
    writeFile(clientMocPath, clientMocContent);
    created.push(`${clientRelPath}/_MOC.md`);
    logEntry(vault, '_MOC.md', `${clientRelPath}/_MOC.md`, `Client MOC for ${client}`);

    // Client Context
    const clientContextFm = {
      type: 'client-context',
      client,
      created: today,
      updated: today,
      tags: ['#type/client-context'],
    };
    const clientContextFile = `${client} — Client Context.md`;
    const clientContextContent =
      yamlBlock(clientContextFm) +
      `\n# ${client} — Client Context\n\n## Brand Foundation\n\n## Key Contacts\n\n## History\n\n---\n*Related:* [[_MOC]]\n`;
    writeFile(path.join(clientAbsPath, clientContextFile), clientContextContent);
    created.push(`${clientRelPath}/${clientContextFile}`);
    logEntry(vault, clientContextFile, `${clientRelPath}/${clientContextFile}`, `Client Context for ${client}`);

    // Meetings folder + _MOC.md
    const meetingsAbsPath = path.join(clientAbsPath, 'Meetings');
    ensureDir(meetingsAbsPath);
    const meetingsMocFm = {
      created: today,
      updated: today,
      tags: ['#type/moc'],
    };
    const meetingsMocContent = yamlBlock(meetingsMocFm) + `\n# ${client} — Meetings\n\n`;
    writeFile(path.join(meetingsAbsPath, '_MOC.md'), meetingsMocContent);
    created.push(`${clientRelPath}/Meetings/_MOC.md`);
    logEntry(vault, '_MOC.md', `${clientRelPath}/Meetings/_MOC.md`, `Meetings MOC for ${client}`);
  }

  // ------------------------------------------------------------------
  // Create project folder and 6 required files
  // ------------------------------------------------------------------
  ensureDir(projectAbsPath);

  // 1. Project _MOC.md
  const projectMocFm = {
    created: today,
    updated: today,
    tags: ['#type/moc'],
  };
  const projectMocContent =
    yamlBlock(projectMocFm) +
    `\n# ${project}\n\n` +
    `## Project Files\n\n` +
    `- [[${project} — Project Context]]\n` +
    `- [[Tech Stack & Architecture]]\n` +
    `- [[Design System]]\n` +
    `- [[Changelog]]\n\n` +
    `## Notes\n\n`;
  writeFile(path.join(projectAbsPath, '_MOC.md'), projectMocContent);
  created.push(`${projectRelPath}/_MOC.md`);
  logEntry(vault, '_MOC.md', `${projectRelPath}/_MOC.md`, `Project MOC for ${project}`);

  // 2. Project Context
  const projectContextFm = {
    type: 'project-context',
    project,
    client,
    status,
    created: today,
    updated: today,
    tags: ['#type/project-context', ...(domain ? [`#domain/${domain}`] : [])],
  };
  const projectContextFile = `${project} — Project Context.md`;
  const projectContextContent =
    yamlBlock(projectContextFm) +
    `\n# ${project} — Project Context\n\n` +
    `## Overview\n\n\n` +
    `## Current Phase\n\n\n` +
    `## Open Questions\n\n\n` +
    `## Key Decisions\n\n\n` +
    `## Blockers\n\n\n` +
    `---\n*Related:* [[_MOC]]\n`;
  writeFile(path.join(projectAbsPath, projectContextFile), projectContextContent);
  created.push(`${projectRelPath}/${projectContextFile}`);
  logEntry(vault, projectContextFile, `${projectRelPath}/${projectContextFile}`, `Project Context for ${project}`);

  // 3. Tech Stack & Architecture
  const techStackFm = {
    type: 'reference',
    project,
    client,
    created: today,
    updated: today,
    tags: ['#type/reference', ...(domain ? [`#domain/${domain}`] : [])],
  };
  const techStackContent =
    yamlBlock(techStackFm) +
    `\n# Tech Stack & Architecture\n\n` +
    `_Stub — document the tech stack, dependencies, and architectural decisions here._\n\n` +
    `---\n*Related:* [[_MOC]] · [[${project} — Project Context]]\n`;
  writeFile(path.join(projectAbsPath, 'Tech Stack & Architecture.md'), techStackContent);
  created.push(`${projectRelPath}/Tech Stack & Architecture.md`);
  logEntry(vault, 'Tech Stack & Architecture.md', `${projectRelPath}/Tech Stack & Architecture.md`, `Tech Stack stub for ${project}`);

  // 4. Design System
  const designSystemFm = {
    type: 'reference',
    project,
    client,
    created: today,
    updated: today,
    tags: ['#type/reference', ...(domain ? [`#domain/${domain}`] : [])],
  };
  const designSystemContent =
    yamlBlock(designSystemFm) +
    `\n# Design System\n\n` +
    `_Stub — document design tokens, brand guidelines, Figma references here._\n\n` +
    `---\n*Related:* [[_MOC]] · [[${project} — Project Context]]\n`;
  writeFile(path.join(projectAbsPath, 'Design System.md'), designSystemContent);
  created.push(`${projectRelPath}/Design System.md`);
  logEntry(vault, 'Design System.md', `${projectRelPath}/Design System.md`, `Design System stub for ${project}`);

  // 5. Changelog
  const changelogFm = {
    type: 'changelog',
    project,
    client,
    created: today,
    updated: today,
    tags: ['#type/changelog'],
  };
  const changelogContent =
    yamlBlock(changelogFm) +
    `\n# Changelog\n\n` +
    `## ${today}\n\n` +
    `- Project scaffolded.\n\n` +
    `---\n*Related:* [[_MOC]] · [[${project} — Project Context]]\n`;
  writeFile(path.join(projectAbsPath, 'Changelog.md'), changelogContent);
  created.push(`${projectRelPath}/Changelog.md`);
  logEntry(vault, 'Changelog.md', `${projectRelPath}/Changelog.md`, `Changelog for ${project}`);

  // 6. Notes/ folder + _MOC.md
  const notesAbsPath = path.join(projectAbsPath, 'Notes');
  ensureDir(notesAbsPath);
  const notesMocFm = {
    created: today,
    updated: today,
    tags: ['#type/moc'],
  };
  const notesMocContent = yamlBlock(notesMocFm) + `\n# ${project} — Notes\n\n`;
  writeFile(path.join(notesAbsPath, '_MOC.md'), notesMocContent);
  created.push(`${projectRelPath}/Notes/_MOC.md`);
  logEntry(vault, '_MOC.md', `${projectRelPath}/Notes/_MOC.md`, `Notes MOC for ${project}`);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        project,
        client,
        category,
        project_path: projectRelPath,
        files_created: created
      }, null, 2)
    }]
  };
}

module.exports = {
  name: 'scaffold_project',
  description: 'Scaffold a new project with all 6 required files (MOC, Project Context, Tech Stack, Design System, Changelog, Notes/) and create the client folder if it does not exist.',
  inputSchema: {
    type: 'object',
    properties: {
      client: {
        type: 'string',
        description: 'Client name (e.g. "Frankl & Thomas" or "Ben Hungerford").'
      },
      project: {
        type: 'string',
        description: 'Project name (e.g. "Shopify Website Build").'
      },
      category: {
        type: 'string',
        enum: ['Personal', 'TBL'],
        description: 'Work category: Personal for freelance/personal, TBL for The Brand Leader employer clients.'
      },
      brand: {
        type: 'string',
        description: 'Brand or product layer for Personal/Ben Hungerford projects (e.g. "Claude Cortex"). Omit for non-Ben Personal clients.'
      },
      status: {
        type: 'string',
        description: 'Initial project status. Defaults to "Planning".',
        default: 'Planning'
      },
      domain: {
        type: 'string',
        description: 'Optional domain tag value (e.g. "shopify", "wordpress"). Added as #domain/<value> tag.'
      }
    },
    required: ['client', 'project', 'category']
  },
  handler
};

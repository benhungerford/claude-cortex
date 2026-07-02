'use strict';

const path = require('node:path');
const { getVaultPath, resolveInsideVault, VaultPathError } = require('../lib/vault-path.js');
const { writeFile, appendFile, ensureDir, fileExists } = require('../lib/file-ops.js');
const { emptyTable } = require('../lib/hub-schema.js');
const { clientProjectsBase } = require('../lib/base-templates.js');

// Reject names that would escape the vault when embedded in a path.
function isUnsafePathSegment(s) {
  if (typeof s !== 'string' || s.length === 0) return true;
  if (s.includes('/') || s.includes('\\')) return true;
  if (s === '.' || s === '..') return true;
  if (s.includes('\0')) return true;
  return false;
}
const { stringifyYaml } = require('../lib/yaml.js');
const { formatChangelogEntry } = require('../lib/changelog-format.js');

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function yamlBlock(data) {
  return `---\n${stringifyYaml(data).trimEnd()}\n---\n`;
}

function logEntry(vault, file, dest, note) {
  const entry = formatChangelogEntry({ action: 'CREATED', file, dest, note });
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
    // Top-level vault folder that holds the bucket categories. Defaults to
    // "Work" (Ben's tree) but is overridable so non-Ben vaults can use their
    // own top-level term from personality.md (e.g. "Engagements", "Clients").
    bucket_root = 'Work',
  } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  // Reject inputs that would let scaffold paths escape the vault.
  // bucket_root, category, client, and project all become path segments.
  for (const [field, value] of [['bucket_root', bucket_root], ['client', client], ['project', project], ['category', category]]) {
    if (isUnsafePathSegment(value)) {
      return {
        content: [{ type: 'text', text: `Invalid ${field}: must not contain path separators or "..".` }],
        isError: true
      };
    }
  }
  if (brand !== undefined && isUnsafePathSegment(brand)) {
    return {
      content: [{ type: 'text', text: `Invalid brand: must not contain path separators or "..".` }],
      isError: true
    };
  }

  const today = todayISO();
  const created = [];

  // Build paths.
  //   <bucket_root>/<category>/<client>/<project>/
  // and, when a brand layer is supplied, it is inserted generically:
  //   <bucket_root>/<category>/<client>/<brand>/<project>/
  // bucket_root and category are persona-driven (from personality.md buckets),
  // not hardcoded to "Work" / "Personal" / "TBL".
  const clientRelPath = `${bucket_root}/${category}/${client}`;
  const projectRelPath = brand
    ? `${clientRelPath}/${brand}/${project}`
    : `${clientRelPath}/${project}`;

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
      `\n# ${client}\n\n## Projects\n\n![[${client} — Projects.base]]\n\n## Notes\n`;
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

    // Client-level Bases dashboard — live view of project hubs in this folder
    const baseFile = `${client} — Projects.base`;
    writeFile(path.join(clientAbsPath, baseFile), clientProjectsBase(clientRelPath));
    created.push(`${clientRelPath}/${baseFile}`);
    logEntry(vault, baseFile, `${clientRelPath}/${baseFile}`, `Bases dashboard for ${client}`);
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
    `## Key Decisions\n\n\n` +
    `${emptyTable()}\n` +
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
        description: 'Bucket category — a freeform term taken from the user\'s personality.md buckets (e.g. "TBL", "Personal", "Consulting", "Clients"). Not a fixed enum; defaults in a standard TBL vault are TBL and Personal, but any vault\'s own bucket terms are valid.'
      },
      bucket_root: {
        type: 'string',
        description: 'Top-level vault folder that holds the bucket categories. Defaults to "Work". Override to match a non-default vault tree (e.g. "Engagements").',
        default: 'Work'
      },
      brand: {
        type: 'string',
        description: 'Optional brand or product layer inserted between client and project (e.g. "Claude Cortex"). Applies to any category. Omit when there is no brand layer.'
      },
      status: {
        type: 'string',
        description: 'Initial project status. Defaults to "Planning".',
        default: 'Planning'
      },
      domain: {
        type: 'string',
        description: 'Optional user-defined domain tag value (e.g. "shopify", "wordpress", "research", "coaching"). Added as #domain/<value> tag. The taxonomy is whatever the user defines in personality.md — not a fixed list.'
      }
    },
    required: ['client', 'project', 'category']
  },
  handler
};

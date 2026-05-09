'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { getVaultPath } = require('../lib/vault-path.js');
const { appendFile } = require('../lib/file-ops.js');
const {
  loadRegistry,
  saveRegistry,
  findProjectByRepoPath,
  canonicalPath
} = require('../lib/registry.js');
const { formatChangelogEntry } = require('../lib/changelog-format.js');

function err(text) {
  return { content: [{ type: 'text', text }], isError: true };
}

async function handler(args, vaultOverride) {
  const { project_id, vault_path, context_file, repo_path } = args;

  for (const [field, value] of [
    ['project_id', project_id],
    ['vault_path', vault_path],
    ['context_file', context_file],
    ['repo_path', repo_path]
  ]) {
    if (typeof value !== 'string' || value.length === 0) {
      return err(`${field} is required (non-empty string).`);
    }
  }

  const vault = vaultOverride || getVaultPath();
  if (!vault) return err('Vault path not configured.');

  // Validate repo_path exists and is a directory.
  let stat;
  try {
    stat = fs.statSync(repo_path);
  } catch {
    return err(`repo_path does not exist: ${repo_path}`);
  }
  if (!stat.isDirectory()) {
    return err(`repo_path is not a directory: ${repo_path}`);
  }

  let registry;
  try {
    registry = loadRegistry(vault);
  } catch (e) {
    return err(
      `Registry at ${canonicalPath(vault)} is malformed (${e.message}). ` +
      `Fix or delete it before re-running register_repo.`
    );
  }

  // Conflict: another project already owns this repo path.
  const owner = findProjectByRepoPath(registry, repo_path);
  if (owner && owner.id !== project_id) {
    return err(
      `Conflict: repo_path "${repo_path}" is already registered to project "${owner.id}". ` +
      `Move it manually or unregister there first.`
    );
  }

  // Append to existing project entry, or create one.
  let project = registry.projects.find((p) => p.id === project_id);
  let action;
  if (project) {
    if (project.repo_paths.includes(repo_path)) {
      action = 'noop';
    } else {
      project.repo_paths.push(repo_path);
      // Update vault_path / context_file if previously blank.
      if (!project.vault_path) project.vault_path = vault_path;
      if (!project.context_file) project.context_file = context_file;
      action = 'appended';
    }
  } else {
    project = {
      id: project_id,
      vault_path,
      context_file,
      repo_paths: [repo_path]
    };
    registry.projects.push(project);
    action = 'created';
  }

  if (action !== 'noop') {
    saveRegistry(vault, registry);

    // Log via the shared changelog formatter (single chokepoint).
    const entry = formatChangelogEntry({
      action: 'CREATED',
      file: 'registry.json',
      dest: '.claude/cortex/',
      note: `Registered repo ${repo_path} against project ${project_id}`
    });
    appendFile(path.join(vault, '_changelog.txt'), entry);
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ action, project }, null, 2)
    }]
  };
}

module.exports = {
  name: 'register_repo',
  description:
    'Register a code repo against a vault project in the canonical repo registry (<vault>/.claude/cortex/registry.json). Creates a new project entry or appends repo_path to an existing one. Refuses to overwrite a repo_path already owned by another project.',
  inputSchema: {
    type: 'object',
    properties: {
      project_id: {
        type: 'string',
        description: 'Slug for the project (e.g. "frankl-thomas-shopify-build").'
      },
      vault_path: {
        type: 'string',
        description: 'Vault-relative path to the project folder (e.g. "Work/TBL/Frankl & Thomas/Shopify Website Build").'
      },
      context_file: {
        type: 'string',
        description: 'Filename of the project Context hub (e.g. "Shopify Website Build — Project Context.md").'
      },
      repo_path: {
        type: 'string',
        description: 'Absolute path to the repo root on this machine.'
      }
    },
    required: ['project_id', 'vault_path', 'context_file', 'repo_path']
  },
  handler
};

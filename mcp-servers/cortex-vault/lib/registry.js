'use strict';

// Canonical repo→project registry.
//
// Single source of truth: <vault>/.claude/cortex/registry.json
//   {
//     "schema_version": 1,
//     "projects": [
//       {
//         "id": "...",
//         "vault_path": "...",
//         "context_file": "...",
//         "repo_paths": ["...", ...]
//       }
//     ]
//   }
//
// The legacy file <vault>/_repo_registry.json is no longer written. It is
// still readable as a fallback by `loadRegistry` so users on older versions
// don't see a sudden "registry empty" until they run the migration.

const fs = require('node:fs');
const path = require('node:path');

const { writeFile, readFile } = require('./file-ops.js');

const CANONICAL_REL = path.join('.claude', 'cortex', 'registry.json');
const LEGACY_REL = '_repo_registry.json';
const SCHEMA_VERSION = 1;

function canonicalPath(vault) {
  return path.join(vault, CANONICAL_REL);
}

function legacyPath(vault) {
  return path.join(vault, LEGACY_REL);
}

function emptyRegistry() {
  return { schema_version: SCHEMA_VERSION, projects: [] };
}

// Read canonical registry. If it doesn't exist, fall back to legacy file
// (one-shot migration target). On any parse error, throw — the caller
// must surface the corruption rather than silently overwrite.
function loadRegistry(vault) {
  const canonical = canonicalPath(vault);
  const canonicalRaw = readFile(canonical);
  if (canonicalRaw !== null) {
    const parsed = JSON.parse(canonicalRaw);
    return normalize(parsed);
  }

  const legacyRaw = readFile(legacyPath(vault));
  if (legacyRaw !== null) {
    const parsed = JSON.parse(legacyRaw);
    return migrateLegacy(parsed);
  }

  return emptyRegistry();
}

// Coerce older shapes into the canonical structure.
function normalize(data) {
  if (!data || typeof data !== 'object') return emptyRegistry();
  if (Array.isArray(data)) return migrateLegacy(data);
  return {
    schema_version: data.schema_version || SCHEMA_VERSION,
    projects: Array.isArray(data.projects) ? data.projects : []
  };
}

// Convert the v0 array-of-{repo_path,...} shape into v1 {projects: [...]}.
function migrateLegacy(arr) {
  if (!Array.isArray(arr)) return emptyRegistry();
  const byId = new Map();
  for (const entry of arr) {
    if (!entry || typeof entry !== 'object') continue;
    const id = entry.project_id || entry.id;
    if (!id) continue;
    let project = byId.get(id);
    if (!project) {
      project = {
        id,
        vault_path: entry.vault_path || '',
        context_file: entry.context_file || '',
        repo_paths: []
      };
      byId.set(id, project);
    }
    if (entry.repo_path && !project.repo_paths.includes(entry.repo_path)) {
      project.repo_paths.push(entry.repo_path);
    }
  }
  return { schema_version: SCHEMA_VERSION, projects: Array.from(byId.values()) };
}

function saveRegistry(vault, registry) {
  fs.mkdirSync(path.dirname(canonicalPath(vault)), { recursive: true });
  writeFile(canonicalPath(vault), JSON.stringify(registry, null, 2) + '\n');
}

// Find which project owns a repo_path (exact match). Returns null if none.
function findProjectByRepoPath(registry, repoPath) {
  const target = path.normalize(repoPath);
  for (const project of registry.projects) {
    for (const p of project.repo_paths || []) {
      if (path.normalize(p) === target) return project;
    }
  }
  return null;
}

// Walk up from cwd, return the first project whose repo_paths contains an
// ancestor of cwd. Returns null when no ancestor matches.
function findProjectByCwd(registry, cwd) {
  let current = path.normalize(cwd);
  while (true) {
    const match = findProjectByRepoPath(registry, current);
    if (match) return match;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

module.exports = {
  CANONICAL_REL,
  LEGACY_REL,
  SCHEMA_VERSION,
  canonicalPath,
  legacyPath,
  emptyRegistry,
  loadRegistry,
  saveRegistry,
  findProjectByRepoPath,
  findProjectByCwd
};

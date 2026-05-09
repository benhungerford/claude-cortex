'use strict';

const path = require('node:path');
const { getVaultPath, resolveInsideVault, VaultPathError } = require('../lib/vault-path.js');
const { readFile } = require('../lib/file-ops.js');
const { extractFrontmatter } = require('../lib/yaml.js');

// Required fields by note type
const REQUIRED_FIELDS = {
  'project-context': ['type', 'project', 'client', 'status', 'tags', 'created', 'updated'],
  'client-context':  ['type', 'client', 'tags', 'created', 'updated'],
  'client':          ['type', 'client', 'status', 'tags', 'created', 'updated'],
  'meeting-notes':   ['tags', 'created', 'updated'],
  'changelog':       ['type', 'project', 'client', 'tags', 'created', 'updated'],
  'reference':       ['tags', 'created', 'updated'],
  'knowledge':       ['tags', 'created', 'updated'],
  'moc':             ['tags', 'created', 'updated'],
  'daily-briefing':  ['type', 'date', 'tags', 'created', 'updated'],
};

// Types where we know exactly which required fields to apply
// (types not in the map fall back to checking tags+created+updated only)
const KNOWN_TYPES = new Set(Object.keys(REQUIRED_FIELDS));

function validateFrontmatter(fm, filePath) {
  const errors = [];

  if (!fm) {
    errors.push('No frontmatter found — file must start with a YAML block between --- delimiters.');
    return errors;
  }

  // Check tags are quoted strings (no null values)
  const tags = fm.tags;
  if (tags !== undefined) {
    if (!Array.isArray(tags)) {
      errors.push('`tags` must be an array.');
    } else {
      tags.forEach((tag, i) => {
        if (tag === null || tag === undefined) {
          errors.push(
            `tags[${i}] is null — likely an unquoted "#tag" value. Wrap it in double quotes: "#tag/value".`
          );
        } else if (typeof tag !== 'string') {
          errors.push(`tags[${i}] is not a string (got ${typeof tag}).`);
        }
      });
    }
  }

  // Determine required fields based on type
  const noteType = fm.type;
  const requiredFields = noteType && KNOWN_TYPES.has(noteType)
    ? REQUIRED_FIELDS[noteType]
    : ['tags', 'created', 'updated'];

  for (const field of requiredFields) {
    if (fm[field] === undefined || fm[field] === null) {
      errors.push(`Missing required field: \`${field}\``);
    }
  }

  return errors;
}

async function handler(args, vaultOverride) {
  const { file_path } = args;

  const vault = vaultOverride || getVaultPath();
  if (!vault) {
    return {
      content: [{ type: 'text', text: 'Vault path not configured.' }],
      isError: true
    };
  }

  let fullPath;
  try {
    fullPath = resolveInsideVault(vault, file_path);
  } catch (err) {
    if (err instanceof VaultPathError) {
      return {
        content: [{ type: 'text', text: `Invalid file_path: ${err.message}` }],
        isError: true
      };
    }
    throw err;
  }

  const content = readFile(fullPath);
  if (content === null) {
    return {
      content: [{ type: 'text', text: `File not found: ${file_path}` }],
      isError: true
    };
  }

  const { frontmatter } = extractFrontmatter(content);
  const errors = validateFrontmatter(frontmatter, file_path);
  const valid = errors.length === 0;

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ valid, errors }, null, 2)
    }]
  };
}

module.exports = {
  name: 'validate_frontmatter',
  description: 'Validate the YAML frontmatter of a vault note. Checks tag quoting, required fields by type, and presence of created/updated.',
  inputSchema: {
    type: 'object',
    properties: {
      file_path: {
        type: 'string',
        description: 'Relative vault path to the file to validate (e.g. Work/TBL/Client/Project/file.md).'
      }
    },
    required: ['file_path']
  },
  handler
};

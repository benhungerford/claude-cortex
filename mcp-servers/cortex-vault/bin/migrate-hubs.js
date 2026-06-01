#!/usr/bin/env node
'use strict';

// Migrate legacy checkbox hubs ("## Open Questions" + "## Blockers") to the
// canonical "## Open Questions & Blockers" pipe-table (lib/hub-schema.js).
//
// Usage:
//   node bin/migrate-hubs.js [vaultPath]            # dry-run (default): report only
//   node bin/migrate-hubs.js [vaultPath] --apply    # write changes
//
// vaultPath defaults to the configured vault (lib/vault-path.js). Safe to run
// repeatedly — already-canonical hubs are left untouched.

const path = require('node:path');
const fs = require('node:fs');
const { getVaultPath } = require('../lib/vault-path.js');
const { extractFrontmatter, stringifyYaml } = require('../lib/yaml.js');
const { migrateBodyToCanonical } = require('../lib/hub-schema.js');

function findHubs(vaultPath) {
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && /[—-] Project Context\.md$/.test(e.name)) out.push(full);
    }
  }
  walk(vaultPath);
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const vaultArg = args.find((a) => !a.startsWith('--'));
  const vault = vaultArg || getVaultPath();
  if (!vault) {
    console.error('No vault path. Pass one as an argument or configure the vault.');
    process.exit(1);
  }

  const hubs = findHubs(vault);
  let changed = 0;
  for (const file of hubs) {
    const content = fs.readFileSync(file, 'utf8');
    const { frontmatter, body } = extractFrontmatter(content);
    const res = migrateBodyToCanonical(body);
    if (!res.changed) continue;
    changed++;
    const rel = path.relative(vault, file);
    if (apply) {
      const yamlStr = frontmatter ? stringifyYaml(frontmatter).trimEnd() : '';
      const final = frontmatter ? `---\n${yamlStr}\n---\n${res.body}` : res.body;
      fs.writeFileSync(file, final);
      console.log(`migrated: ${rel}`);
    } else {
      console.log(`would migrate: ${rel}`);
    }
  }

  console.log(
    `\n${changed} hub(s) ${apply ? 'migrated' : 'need migration'} of ${hubs.length} scanned.` +
    (!apply && changed ? ' Re-run with --apply to write changes.' : '')
  );
}

if (require.main === module) main();
module.exports = { findHubs };

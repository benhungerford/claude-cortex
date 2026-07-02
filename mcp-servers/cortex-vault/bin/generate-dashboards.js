#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { clientProjectsBase } = require('../lib/base-templates.js');
const { formatChangelogEntry } = require('../lib/changelog-format.js');

// A "client folder" is any folder whose _MOC.md frontmatter contains
// `type: client`. Walk the vault, skipping dotfolders and known non-content dirs.
function findClientFolders(vault) {
  const out = [];
  const skip = new Set(['.obsidian', '.claude', '.git', 'node_modules']);
  (function walk(rel) {
    const abs = path.join(vault, rel);
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!entry.isDirectory() || skip.has(entry.name)) continue;
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const mocPath = path.join(vault, childRel, '_MOC.md');
      if (fs.existsSync(mocPath)) {
        const head = fs.readFileSync(mocPath, 'utf8').slice(0, 500);
        if (/^type:\s*client\s*$/m.test(head)) {
          out.push(childRel);
          continue; // clients don't nest
        }
      }
      walk(childRel);
    }
  })('');
  return out;
}

function backfill(vault, apply) {
  const plan = [];
  for (const clientRel of findClientFolders(vault)) {
    const client = path.basename(clientRel);
    const baseFile = `${client} — Projects.base`;
    const baseAbs = path.join(vault, clientRel, baseFile);
    if (fs.existsSync(baseAbs)) continue;
    plan.push({ clientRel, baseFile });
    if (!apply) continue;

    fs.writeFileSync(baseAbs, clientProjectsBase(clientRel));

    const mocAbs = path.join(vault, clientRel, '_MOC.md');
    let moc = fs.readFileSync(mocAbs, 'utf8');
    const embed = `![[${baseFile}]]`;
    if (!moc.includes(embed)) {
      moc = moc.includes('## Projects')
        ? moc.replace('## Projects', `## Projects\n\n${embed}`)
        : moc.trimEnd() + `\n\n${embed}\n`;
      fs.writeFileSync(mocAbs, moc);
    }

    fs.appendFileSync(path.join(vault, '_changelog.txt'), formatChangelogEntry({
      action: 'CREATED',
      file: baseFile,
      dest: `${clientRel}/${baseFile}`,
      note: 'Backfilled Bases dashboard'
    }));
  }
  return plan;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const vault = args.find((a) => a !== '--apply');
  if (!vault) {
    console.error('Usage: node generate-dashboards.js <vaultPath> [--apply]');
    process.exit(1);
  }
  const plan = backfill(vault, apply);
  if (plan.length === 0) {
    console.log('Nothing to do — all client folders already have dashboards.');
  } else {
    for (const p of plan) console.log(`${apply ? 'CREATED' : 'WOULD CREATE'} ${p.clientRel}/${p.baseFile}`);
    if (!apply) console.log('\nDry run. Re-run with --apply to write.');
  }
}

module.exports = { findClientFolders, backfill };

'use strict';

// Obsidian Bases YAML templates (JSON Canvas / Bases spec per
// https://help.obsidian.md/bases). Filter strings are single-quoted inside
// the YAML so the double-quoted property values survive.

function folderFilterLine(scopeFolder) {
  if (!scopeFolder) return '';
  return `    - 'file.inFolder("${scopeFolder}")'\n`;
}

function projectsBase(scopeFolder) {
  return (
    'filters:\n' +
    '  and:\n' +
    `    - 'type == "project-context"'\n` +
    folderFilterLine(scopeFolder) +
    'formulas:\n' +
    `  days_idle: '(now() - file.mtime).days'\n` +
    'properties:\n' +
    '  note.status:\n' +
    '    displayName: Status\n' +
    '  note.client:\n' +
    '    displayName: Client\n' +
    '  formula.days_idle:\n' +
    '    displayName: Days idle\n' +
    'views:\n' +
    '  - type: table\n' +
    '    name: Projects\n' +
    '    order:\n' +
    '      - file.name\n' +
    '      - status\n' +
    '      - client\n' +
    '      - updated\n' +
    '      - formula.days_idle\n' +
    '  - type: table\n' +
    '    name: Active\n' +
    '    filters:\n' +
    '      and:\n' +
    `        - '!status.contains("Archived")'\n` +
    '    order:\n' +
    '      - file.name\n' +
    '      - status\n' +
    '      - updated\n'
  );
}

function clientProjectsBase(scopeFolder) {
  return projectsBase(scopeFolder);
}

function allProjectsBase(scopeFolder) {
  return projectsBase(scopeFolder);
}

module.exports = { clientProjectsBase, allProjectsBase };

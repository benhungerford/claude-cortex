const yaml = require('js-yaml');

/**
 * Parse a YAML string to a JavaScript object.
 * @param {string} content
 * @returns {object}
 */
function parseYaml(content) {
  return yaml.load(content);
}

/**
 * Stringify a JavaScript object to YAML, ensuring any string values
 * starting with '#' are always double-quoted (preventing YAML comment parsing).
 *
 * js-yaml already knows '#' strings need quoting. By passing quotingType: '"'
 * we ensure it uses double quotes (not single) when quoting is required.
 * This satisfies the vault's invariant: tags like "#type/meeting-notes" must
 * appear as double-quoted strings in YAML output.
 *
 * @param {object} data
 * @returns {string}
 */
function stringifyYaml(data) {
  return yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
  });
}

/**
 * Extract YAML frontmatter from a markdown file's content.
 * Returns { frontmatter: object|null, body: string }.
 * @param {string} fileContent
 * @returns {{ frontmatter: object|null, body: string }}
 */
function extractFrontmatter(fileContent) {
  if (!fileContent.startsWith('---')) {
    return { frontmatter: null, body: fileContent };
  }

  const end = fileContent.indexOf('\n---', 3);
  if (end === -1) {
    return { frontmatter: null, body: fileContent };
  }

  const yamlBlock = fileContent.slice(3, end).trim();
  const body = fileContent.slice(end + 4).replace(/^\n/, '');

  let frontmatter = null;
  try {
    frontmatter = yaml.load(yamlBlock) || null;
  } catch {
    frontmatter = null;
  }

  return { frontmatter, body };
}

/**
 * Replace the frontmatter block in a markdown file, preserving the body.
 * @param {string} fileContent - Original file content
 * @param {object} newFrontmatter - New frontmatter object to serialize
 * @returns {string}
 */
function replaceFrontmatter(fileContent, newFrontmatter) {
  const { body } = extractFrontmatter(fileContent);
  const yamlStr = stringifyYaml(newFrontmatter).trimEnd();
  return `---\n${yamlStr}\n---\n${body}`;
}

module.exports = { parseYaml, stringifyYaml, extractFrontmatter, replaceFrontmatter };

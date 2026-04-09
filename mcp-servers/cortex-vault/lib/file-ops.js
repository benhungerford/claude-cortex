const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const tmpPath = filePath + '.tmp.' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function appendFile(filePath, line) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  const suffix = line.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(filePath, line + suffix, 'utf8');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

module.exports = { readFile, writeFile, appendFile, ensureDir, fileExists };

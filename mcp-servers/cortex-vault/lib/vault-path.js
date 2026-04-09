const fs = require('node:fs');
const path = require('node:path');

let cached = undefined; // undefined = not yet read, null = read but invalid

function getVaultPath() {
  if (cached !== undefined) return cached;

  const configPath = path.join(
    process.env.HOME || '',
    '.claude', 'cortex', 'config.json'
  );

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(raw);
    const vaultPath = config.vault_path;

    if (vaultPath && fs.existsSync(vaultPath) && fs.statSync(vaultPath).isDirectory()) {
      cached = vaultPath;
    } else {
      cached = null;
    }
  } catch {
    cached = null;
  }

  return cached;
}

function clearCache() {
  cached = undefined;
}

module.exports = { getVaultPath, clearCache };

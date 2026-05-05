const fs = require('node:fs');
const path = require('node:path');

let cached = undefined; // undefined = not yet read, null = read but invalid

class VaultPathError extends Error {
  constructor(message) {
    super(message);
    this.name = 'VaultPathError';
  }
}

// Resolve a vault-relative path to an absolute path, asserting the result
// stays inside the vault root. Rejects absolute inputs and any path whose
// resolved form escapes the vault (via `..`, symlinks, or otherwise).
//
// Returns the absolute path on success. Throws VaultPathError on any breach.
function resolveInsideVault(vault, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) {
    throw new VaultPathError('path must be a non-empty string');
  }
  if (path.isAbsolute(relPath)) {
    throw new VaultPathError(
      `absolute paths are not accepted (got "${relPath}"); pass a vault-relative path`
    );
  }
  const vaultReal = fs.realpathSync.native
    ? safeRealpath(vault)
    : path.resolve(vault);
  const joined = path.resolve(vaultReal, relPath);
  // joined must equal vaultReal or be a strict descendant.
  if (joined !== vaultReal && !joined.startsWith(vaultReal + path.sep)) {
    throw new VaultPathError(
      `path "${relPath}" resolves outside the vault`
    );
  }
  return joined;
}

function safeRealpath(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return path.resolve(p);
  }
}

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

module.exports = { getVaultPath, clearCache, resolveInsideVault, VaultPathError };

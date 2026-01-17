


//// util

import type { PackageInfo } from "../types.ts";

/**
 * Read version from various sources with fallback priority:
 * 1. version.txt file (if exists)
 * 2. deno.json version field
 * 3. Hardcoded fallback
 */
async function getVersion(): Promise<string> {
  const fallbackVersion = "0.1.0";

  // Try to read from version.txt first
  try {
    const versionText = await Deno.readTextFile("version.txt");
    const version = versionText.trim();
    if (version) return version;
  } catch {
    // version.txt doesn't exist or isn't readable, continue to next option
  }

  // Try to read from deno.json
  try {
    const denoConfigText = await Deno.readTextFile("deno.json");
    const denoConfig = JSON.parse(denoConfigText);
    if (denoConfig.version) return denoConfig.version;
  } catch {
    // deno.json doesn't exist or isn't readable, continue to fallback
  }

  // Fall back to hardcoded version
  return fallbackVersion;
}

// Initialize version dynamically
let _version: string | null = null;
let _versionPromise: Promise<string> | null = null;

function getVersionSync(): string {
  if (_version !== null) {
    return _version;
  }

  // If we haven't loaded version yet, start loading and return fallback
  if (_versionPromise === null) {
    _versionPromise = getVersion().then(v => {
      _version = v;
      return v;
    });
  }

  // Return fallback while loading
  return "0.1.0";
}

// Try to preload version
getVersion().then(v => _version = v).catch(() => _version = "0.1.0");



//// export

export const pkg: PackageInfo = {
  get agent() {
    const version = getVersionSync();
    return `@eol/git@${version}`;
  },
  name: "@eol/git",
  get version() {
    return getVersionSync();
  }
};

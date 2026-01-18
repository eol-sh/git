


//// util

import { GitConfig } from "../models/git-config.ts";
import { join } from "../utils/join.ts";

interface ConfigLocation {
  exists: boolean;
  path: string;
  scope: "local" | "global" | "system";
}

interface FileSystemLike {
  read(filepath: string, options?: { encoding?: string }): Promise<string>;
  write(filepath: string, contents: string, options?: { encoding?: string }): Promise<void>;
  exists(filepath: string): Promise<boolean>;
}



//// export

export interface GitConfigManagerGetOptions {
  dir?: string; /*** Working directory for finding system config ***/
  fs: FileSystemLike;
  gitdir: string;
}

export interface GitConfigManagerSaveOptions {
  config: GitConfig;
  fs: FileSystemLike;
  gitdir: string;
  scope?: "local" | "global" | "system"; /*** Which config file to save to ***/
}

export class GitConfigManager {
  /**
   * Get git configuration by reading from all config file locations in priority order
   */
  static async get({ dir, fs, gitdir }: GitConfigManagerGetOptions): Promise<GitConfig> {
    const locations = await this._getConfigLocations({
      ...(dir !== undefined ? { dir } : {}),
      fs,
      gitdir
    });

    /*** Start with empty config and merge in priority order (system -> global -> local) ***/
    const mergedConfig = GitConfig.from("");

    for (const location of locations) {
      if (location.exists) {
        try {
          const text = await fs.read(location.path, { encoding: "utf8" });
          const config = GitConfig.from(text);

          /*** Simple merge - later configs override earlier ones
          Note: In a full implementation, this would be more sophisticated ***/
          for (const [key, value] of Object.entries(await config.getall(""))) {
            if (Array.isArray(value)) {
              for (const v of value) {
                await mergedConfig.set(key, v);
              }
            } else if (value !== undefined && value !== null) {
              await mergedConfig.set(key, value);
            }
          }
        } catch(error) {
          /*** Skip files that can’t be read ***/
          console.warn(`Could not read config file ${location.path}: ${String(error)}`);
        }
      }
    }

    return mergedConfig;
  }

  /**
   * Save configuration to the appropriate config file
   */
  static async save({ config, fs, gitdir, scope = "local" }: GitConfigManagerSaveOptions): Promise<void> {
    const locations = await this._getConfigLocations({ fs, gitdir });
    const targetLocation = locations.find(loc => loc.scope === scope);

    if (!targetLocation)
      throw new Error(`Cannot determine ${scope} config file location`);

    await fs.write(targetLocation.path, config.toString(), { encoding: "utf8" });
  }

  /**
   * Get all potential config file locations
   */
  private static async _getConfigLocations({ dir: _dir, fs, gitdir }: { dir?: string; fs: FileSystemLike; gitdir: string; }): Promise<ConfigLocation[]> {
    const locations: ConfigLocation[] = [];

    // System config (lowest priority) - comprehensive detection
    const systemPaths = this._getSystemConfigPaths();

    for (const systemPath of systemPaths) {
      try {
        const exists = await fs.exists(systemPath);
        if (exists) {
          locations.push({ exists, path: systemPath, scope: "system" });
          break; // Use first available system config
        }
      } catch {
        // System paths may not be accessible, continue
      }
    }

    // If no system config found, add placeholder for completeness
    if (!locations.some(loc => loc.scope === "system")) {
      locations.push({ exists: false, path: systemPaths[0], scope: "system" });
    }

    // Global config (medium priority) - comprehensive HOME detection
    const globalPath = this._getGlobalConfigPath();

    try {
      const exists = await fs.exists(globalPath);
      locations.push({ exists, path: globalPath, scope: "global" });
    } catch {
      locations.push({ exists: false, path: globalPath, scope: "global" });
    }

    // Local/repository config (highest priority)
    const localPath = join(gitdir, "config");

    try {
      const exists = await fs.exists(localPath);
      locations.push({ exists, path: localPath, scope: "local" });
    } catch {
      locations.push({ exists: false, path: localPath, scope: "local" });
    }

    return locations;
  }

  /**
   * Get system config paths in priority order based on platform
   */
  private static _getSystemConfigPaths(): string[] {
    const platform = Deno.build.os;

    switch (platform) {
      case "windows": {
        // Windows system config paths
        const programFiles = Deno.env.get("ProgramFiles") || "C:\\Program Files";
        const programFilesX86 = Deno.env.get("ProgramFiles(x86)") || "C:\\Program Files (x86)";
        return [
          `${programFiles}\\Git\\etc\\gitconfig`,
          `${programFilesX86}\\Git\\etc\\gitconfig`,
          "C:\\etc\\gitconfig",
          "C:\\gitconfig"
        ];
      }

      case "darwin": {
        // macOS system config paths
        return [
          "/usr/local/etc/gitconfig",     // Homebrew git
          "/opt/homebrew/etc/gitconfig",  // Apple Silicon Homebrew
          "/etc/gitconfig",               // System git
          "/Library/Application Support/Git/config"  // macOS GUI apps
        ];
      }

      default: {
        // Linux/Unix system config paths
        const prefix = Deno.env.get("GIT_CONFIG_SYSTEM") || "/etc/gitconfig";
        return [
          prefix,
          "/usr/local/etc/gitconfig",
          "/etc/git/gitconfig",
          "/etc/gitconfig"
        ];
      }
    }
  }

  /**
   * Get global config path with proper HOME detection
   */
  private static _getGlobalConfigPath(): string {
    const platform = Deno.build.os;

    if (platform === "windows") {
      // Windows: Use USERPROFILE or HOMEDRIVE+HOMEPATH
      const userProfile = Deno.env.get("USERPROFILE");
      if (userProfile) {
        return join(userProfile, ".gitconfig");
      }

      const homeDrive = Deno.env.get("HOMEDRIVE") || "C:";
      const homePath = Deno.env.get("HOMEPATH") || "\\Users\\Default";
      return join(homeDrive + homePath, ".gitconfig");
    }

    // Unix-like systems: Use HOME or fallback
    const home = Deno.env.get("HOME");
    if (home) {
      return join(home, ".gitconfig");
    }

    // Fallback for systems without HOME
    const user = Deno.env.get("USER") || Deno.env.get("USERNAME") || "unknown";
    if (platform === "darwin") {
      return `/Users/${user}/.gitconfig`;
    } else {
      return `/home/${user}/.gitconfig`;
    }
  }
}

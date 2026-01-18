/**
 * @fileoverview Git get-config-all command implementation
 *
 * Internal implementation of the get-config-all Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/get-config-all.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import type { FsInterface } from "../types.ts";

interface GetConfigAllOptions {
  fs: FsInterface;
  gitdir: string;
  path: string;
}



//// export

/**
 * Read all config values for a given path
 */
export async function _getConfigAll({ fs, gitdir, path }: GetConfigAllOptions): Promise<any[]> {
  const unifiedFs = adaptFsInterface(fs);
  const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });

  return config.getall(path);
}

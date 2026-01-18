/**
 * @fileoverview Git get-config command implementation
 *
 * Internal implementation of the get-config Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/get-config.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import type { FsInterface } from "../types.ts";

interface GetConfigOptions {
  fs: FsInterface;
  gitdir: string;
  path: string;
}



//// export

/**
 * Read config value
 */
export async function _getConfig({ fs, gitdir, path }: GetConfigOptions): Promise<any> {
  const unifiedFs = adaptFsInterface(fs);
  const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });

  return config.get(path);
}

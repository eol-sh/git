


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

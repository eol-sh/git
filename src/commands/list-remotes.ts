


/**
 * @fileoverview Command for listing configured Git remote repositories
 * 
 * This module provides functionality to list all configured remote repositories
 * in a Git repository. The command reads the repository configuration to extract
 * remote names and their associated URLs, providing a complete overview of all
 * configured remotes. This information is essential for understanding repository
 * connectivity and managing push/fetch operations with multiple remote repositories.
 * 
 * @module commands/list-remotes
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import type { FsInterface } from "../types.ts";

interface ListRemotesOptions {
  fs: FsInterface;
  gitdir: string;
}

interface RemoteInfo {
  remote: string;
  url: string;
}



//// export

export async function _listRemotes({ fs, gitdir }: ListRemotesOptions): Promise<RemoteInfo[]> {
  const unifiedFs = adaptFsInterface(fs);
  const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });
  const remoteNames = await config.getSubsections("remote");

  const remotes = await Promise.all(
    remoteNames.map(async(remote) => {
      const url = await config.get(`remote.${remote}.url`) as string;
      return { remote: remote as string, url };
    })
  );

  return remotes;
}

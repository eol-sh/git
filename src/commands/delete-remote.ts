


/**
 * @fileoverview Command for removing Git remote configurations
 * 
 * This module provides functionality to delete Git remote configurations from
 * the repository's configuration. The command removes all configuration entries
 * associated with a specific remote name, including URL, fetch refspecs, and
 * any other remote-specific settings. This is a clean operation that removes
 * the entire remote configuration section while preserving other configuration
 * data.
 * 
 * @module commands/delete-remote
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import type { FsInterface } from "../types.ts";

interface DeleteRemoteOptions {
  fs: FsInterface;
  gitdir: string;
  remote: string;
}



//// export

export async function _deleteRemote({ fs, gitdir, remote }: DeleteRemoteOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);
  const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });

  await config.deleteSection("remote", remote);
  await GitConfigManager.save({ config, fs: unifiedFs, gitdir });
}




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

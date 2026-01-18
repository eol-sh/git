


//// import

import cleanGitRef from "clean-git-ref";

//// util

import { adaptFsForGitConfig } from "../utils/fs-adapter.ts";
import { AlreadyExistsError } from "../errors/already-exists.ts";
import { FileSystem } from "../models/file-system.ts";
import { InvalidRefNameError } from "../errors/invalid-ref-name.ts";
import { GitConfigManager } from "../managers/git-config.ts";

import type { FsInterface } from "../types.ts";

interface AddRemoteOptions {
  force: boolean;
  fs: FsInterface;
  gitdir: string;
  remote: string;
  url: string;
}



//// export

export async function _addRemote({ force, fs, gitdir, remote, url }: AddRemoteOptions): Promise<void> {
  const configFs = adaptFsForGitConfig(new FileSystem(fs));

  if (remote !== cleanGitRef.clean(remote))
    throw new InvalidRefNameError(remote, cleanGitRef.clean(remote));

  const config = await GitConfigManager.get({ fs: configFs, gitdir });

  if (!force) {
    /*** Check that setting it wouldn’t overwrite. ***/
    const remoteNames = await config.getSubsections("remote");

    if (remoteNames.includes(remote)) {
      /*** Throw an error if it would overwrite an existing remote,
      but not if it’s simply setting the same value again. ***/
      if (url !== (await config.get(`remote.${remote}.url`)))
        throw new AlreadyExistsError("remote", remote);
    }
  }

  await config.set(`remote.${remote}.url`, url);

  await config.set(
    `remote.${remote}.fetch`,
    `+refs/heads/*:refs/remotes/${remote}/*`
  );

  await GitConfigManager.save({ config, fs: configFs, gitdir });
}

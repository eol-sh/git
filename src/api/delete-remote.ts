


//// util

import { _deleteRemote } from "../commands/delete-remote.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface DeleteRemoteOptions {
  cache?: Cache;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  remote: string;
}



//// export

/**
 * Removes the local config entry for a given remote
 */
export async function deleteRemote({
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  remote
}: DeleteRemoteOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);

    const fs = adaptFileSystem(new FileSystem(_fs));
    assertParameter("remote", remote);

    return await _deleteRemote({
      fs,
      gitdir,
      remote
    });
  } catch(err: unknown) {
    (err as any).caller = "git.deleteRemote";
    throw err;
  }
}




//// util

import { _init } from "../commands/init.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface InitOptions {
  bare?: boolean;
  defaultBranch?: string;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
}



//// export

/**
 * Initialize a new repository
 */
export async function init({
  bare = false,
  defaultBranch = "primary",
  dir,
  fs: _fs,
  gitdir = bare ?
    dir :
    join(dir!, ".git")
}: InitOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);

    if (!bare)
      assertParameter("dir", dir);

    /*** Check if _fs is already a FileSystem instance ***/
    const fileSystem = _fs instanceof FileSystem ?
      _fs :
      new FileSystem(_fs);

    const fs = adaptFileSystem(fileSystem);

    return await _init({
      bare,
      defaultBranch,
      ...(dir !== undefined ? { dir } : {}),
      fs,
      ...(gitdir !== undefined ? { gitdir } : {})
    });
  } catch(err: unknown) {
    (err as any).caller = "git.init";
    throw err;
  }
}

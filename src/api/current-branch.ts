


//// util

import { _currentBranch } from "../commands/current-branch.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface CurrentBranchOptions {
  dir?: string;
  fs: FsClient;
  fullname?: boolean;
  gitdir?: string;
  test?: boolean;
}



//// export

/**
 * Get the name of the branch currently pointed to by .git/HEAD
 */
export async function currentBranch({
  dir,
  fs: _fs,
  fullname = false,
  gitdir = join(dir!, ".git"),
  test = false
}: CurrentBranchOptions): Promise<string | undefined> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);

    const fs = adaptFileSystem(new FileSystem(_fs));

    return await _currentBranch({
      fs,
      fullname,
      gitdir,
      test
    });
  } catch(err: unknown) {
    (err as any).caller = "git.currentBranch";
    throw err;
  }
}




//// util

import { adaptFsInterfaceForGitIndex } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsInterface } from "../types.ts";

interface RemoveOptions {
  cache?: Cache;
  dir?: string;
  filepath: string;
  fs: FsInterface;
  gitdir?: string;
}



//// export

/**
 * Remove a file from the git index (aka staging area)
 */
export async function remove({
  cache = new Map(),
  dir,
  filepath,
  fs: _fs,
  gitdir = join(dir!, ".git")
}: RemoveOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const indexFs = adaptFsInterfaceForGitIndex(_fs);

    await GitIndexManager.acquire(
      { cache, fs: indexFs, gitdir }, (index: any) => {
        index.delete({ filepath });
      }
    );
  } catch(err: unknown) {
    (err as any).caller = "git.remove";
    throw err;
  }
}

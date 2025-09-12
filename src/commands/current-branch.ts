


//// util

import { abbreviateRef } from "../utils/abbreviate-ref.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitRefManager } from "../managers/git-ref.ts";

import type { FsInterface } from "../types.ts";

interface CurrentBranchOptions {
  fs: FsInterface;
  fullname?: boolean;
  gitdir: string;
  test?: boolean;
}



//// export

/**
 * Get the name of the current branch
 * @returns The name of the current branch or undefined if the HEAD is detached.
 */
export async function _currentBranch({
  fs,
  fullname = false,
  gitdir,
  test = false
}: CurrentBranchOptions): Promise<string | undefined> {
  const unifiedFs = adaptFsInterface(fs);

  const ref = await GitRefManager.resolve({
    depth: 2,
    fs: unifiedFs,
    gitdir,
    ref: "HEAD"
  });

  if (test) {
    try {
      await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });
    } catch {
      return;
    }
  }

  /*** Return `undefined` for detached HEAD ***/
  if (!ref.startsWith("refs/"))
    return;

  return fullname ?
    ref :
    abbreviateRef(ref);
}




//// util

import { _renameBranch } from "../commands/rename-branch.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface RenameBranchOptions {
  cache?: Cache;
  checkout?: boolean;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  oldref: string;
  ref: string;
}



//// export

/**
 * Rename a branch
 */
export async function renameBranch({
  checkout = false,
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  oldref,
  ref
}: RenameBranchOptions): Promise<void> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);
    assertParameter("oldref", oldref);

    return await _renameBranch({
      checkout,
      fs: adaptFsInterface(fs),
      gitdir,
      oldref,
      ref
    });
  } catch(err: unknown) {
    (err as any).caller = "git.renameBranch";
    throw err;
  }
}

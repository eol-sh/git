


//// util

import { _deleteBranch } from "../commands/delete-branch.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface DeleteBranchOptions {
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  ref: string;
  cache?: Cache;
}



//// export

/**
 * Delete a local branch
 *
 * > Note: This only deletes loose branches - it should be fixed in the future to delete packed branches as well.
 */
export async function deleteBranch({
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  ref
}: DeleteBranchOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);

    const fs = adaptFileSystem(new FileSystem(_fs));
    assertParameter("ref", ref);

    return await _deleteBranch({
      fs,
      gitdir,
      ref
    });
  } catch(err: unknown) {
    (err as any).caller = "git.deleteBranch";
    throw err;
  }
}

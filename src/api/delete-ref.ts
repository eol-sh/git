


//// util

import "../typedefs.ts";

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface DeleteRefOptions {
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  ref: string;
}



//// export

/**
 * Delete a local ref
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The ref to delete
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.deleteRef({ dir: "/tutorial", fs, ref: "refs/tags/test-tag" });
 * console.log("done");
 */
export async function deleteRef({ dir, fs: _fs, gitdir = join(dir!, ".git"), ref }: DeleteRefOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(_fs);

  try {
    assertParameter("fs", _fs);
    assertParameter("ref", ref);

    await GitRefManager.deleteRef({ fs: unifiedFs, gitdir, ref });
  } catch(err: unknown) {
    (err as any).caller = "git.deleteRef";
    throw err;
  }
}

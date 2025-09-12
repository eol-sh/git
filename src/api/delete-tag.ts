


//// util

import "../typedefs.ts";

import { _deleteTag } from "../commands/delete-tag.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface DeleteTagOptions {
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  ref: string;
}



//// export

/**
 * Delete a local tag ref
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - The tag to delete
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.deleteTag({ fs, dir: "/tutorial", ref: "test-tag" });
 * console.log("done");
 */
export async function deleteTag({ fs: _fs, dir, gitdir = join(dir!, ".git"), ref }: DeleteTagOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("ref", ref);

    const fs = adaptFileSystem(new FileSystem(_fs));

    return await _deleteTag({
      fs,
      gitdir,
      ref
    });
  } catch(err: unknown) {
    (err as any).caller = "git.deleteTag";
    throw err;
  }
}




//// util

import { _listFiles } from "../commands/list-files.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsInterface } from "../types.ts";



//// export

export interface ListFilesOptions {
  cache?: Cache;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  ref?: string;
}

/**
 * List all the files in the git index or a commit
 *
 * > Note: This function is efficient for listing the files in the staging area, but listing all the files in a commit requires recursively walking through the git object store.
 * > If you do not require a complete list of every file, better performance can be achieved by using [walk](./walk) and ignoring subdirectories you don’t care about.
 *
 * @param args - The options for listFiles
 * @param args.fs - a file system client
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.ref - Return a list of all the files in the commit at `ref` instead of the files currently in the git index (aka staging area)
 * @param args.cache - a [cache](cache.md) object
 *
 * @returns Resolves successfully with an array of filepaths
 *
 * @example
 * // All the files in the previous commit
 * let files = await git.listFiles({ dir: "/tutorial", fs, ref: "HEAD" });
 * console.log(files);
 * // All the files in the current staging area
 * files = await git.listFiles({ dir: "/tutorial", fs });
 * console.log(files);
 */
export async function listFiles({
  cache = new Map(),
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  ref
}: ListFilesOptions): Promise<string[]> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);

    return await _listFiles({
      cache,
      fs: adaptFileSystem(new FileSystem(fs)),
      gitdir,
      ...(ref !== undefined ? { ref } : {})
    });
  } catch(err: unknown) {
    (err as any).caller = "git.listFiles";
    throw err;
  }
}




//// util

import "../typedefs.ts";

import { _findRoot } from "../commands/find-root.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";

import type { FsClient } from "../types.ts";

interface FindRootOptions {
  filepath: string;
  fs: FsClient;
}



//// export

/**
 * Find the root git directory
 *
 * Starting at `filepath`, walks upward until it finds a directory that contains a subdirectory called ".git".
 *
 * @param {Object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} args.filepath - The file directory to start searching in.
 *
 * @returns {Promise<string>} Resolves successfully with a root git directory path
 * @throws {NotFoundError}
 *
 * @example
 * let gitroot = await git.findRoot({
 *   filepath: "/tutorial/src/utils",
 *   fs
 * });
 *
 * console.log(gitroot);
 */
export async function findRoot({ fs: _fs, filepath }: FindRootOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);
    assertParameter("filepath", filepath);

    const fs = adaptFileSystem(new FileSystem(_fs));
    return await _findRoot({ filepath, fs });
  } catch(err: unknown) {
    (err as any).caller = "git.findRoot";
    throw err;
  }
}

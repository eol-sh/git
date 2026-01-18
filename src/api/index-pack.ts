/**
 * @fileoverview Git index-pack API - High-level user interface
 *
 * This module provides the public API for index-pack operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/index-pack.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { _indexPack } from "../commands/index-pack.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";



//// export

/**
 * Create the .idx file for a given .pack file
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {ProgressCallback} [args.onProgress] - optional progress event callback
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - The path to the .pack file to index
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<{oids: string[]}>} Resolves with a list of the SHA-1 object ids contained in the packfile
 *
 * @example
 * let packfiles = await fs.promises.readdir("/tutorial/.git/objects/pack");
 * packfiles = packfiles.filter(name => name.endsWith(".pack"));
 * console.log("packfiles", packfiles);
 *
 * const { oids } = await git.indexPack({
 *   dir: "/tutorial",
 *   filepath: `.git/objects/pack/${packfiles[0]}`,
 *   fs,
 *   async onProgress(evt) {
 *     console.log(`${evt.phase}: ${evt.loaded} / ${evt.total}`);
 *   }
 * });
 *
 * console.log(oids);
 */
export async function indexPack({
  cache = new Map(),
  dir,
  filepath,
  fs: _fs,
  gitdir = join(dir, ".git"),
  onProgress
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", dir);
    assertParameter("filepath", filepath);

    const fileSystem = new FileSystem(_fs);
    const fs = adaptFileSystem(fileSystem);

    return await _indexPack({
      cache,
      dir,
      filepath,
      fs,
      gitdir,
      onProgress
    });
  } catch(err) {
    (err as any).caller = "git.indexPack";
    throw err;
  }
}

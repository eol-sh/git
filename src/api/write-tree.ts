/**
 * @fileoverview Git write-tree API - High-level user interface
 *
 * This module provides the public API for write-tree operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/write-tree.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { _writeTree } from "../commands/write-tree.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";



//// export

/**
 * Write a tree object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {TreeObject} args.tree - The object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object.
 * @see TreeObject
 * @see TreeEntry
 */
export async function writeTree({ fs, dir, gitdir = join(dir, ".git"), tree }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("tree", tree);

    return await _writeTree({
      fs: adaptFsInterface(fs),
      gitdir,
      tree
    });
  } catch(err) {
    (err as any).caller = "git.writeTree";
    throw err;
  }
}

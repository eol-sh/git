/**
 * @fileoverview Git list-tags API - High-level user interface
 *
 * This module provides the public API for list-tags operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/list-tags.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";



//// export

/**
 * List tags
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 *
 * @returns {Promise<Array<string>>} Resolves successfully with an array of tag names
 *
 * @example
 * let tags = await git.listTags({ fs, dir: "/tutorial" })
 * console.log(tags)
 */
export function listTags({ fs, dir, gitdir = join(dir, ".git") }) {
  const unifiedFs = adaptFsInterface(fs);

  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);

    return GitRefManager.listTags({ fs: unifiedFs, gitdir });
  } catch(err) {
    (err as any).caller = "git.listTags";
    throw err;
  }
}

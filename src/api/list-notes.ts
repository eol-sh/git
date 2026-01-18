/**
 * @fileoverview Git list-notes API - High-level user interface
 *
 * This module provides the public API for list-notes operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/list-notes.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { _listNotes } from "../commands/list-notes.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";



//// export

/**
 * List all the object notes
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - The notes ref to look under
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<Array<{target: string, note: string}>>} Resolves successfully with an array of entries containing SHA-1 object ids of the note and the object the note targets
 */

export async function listNotes({
  cache = new Map(),
  dir,
  fs,
  gitdir = join(dir, ".git"),
  ref = "refs/notes/commits"
}) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);

    return await _listNotes({
      cache,
      fs: adaptFileSystem(new FileSystem(fs)),
      gitdir,
      ref
    });
  } catch(err) {
    (err as any).caller = "git.listNotes";
    throw err;
  }
}

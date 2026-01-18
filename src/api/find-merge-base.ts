/**
 * @fileoverview Git find-merge-base API - High-level user interface
 *
 * This module provides the public API for find-merge-base operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/find-merge-base.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { _findMergeBase } from "../commands/find-merge-base.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface FindMergeBaseOptions {
  cache?: Cache;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  oids: string[];
}



//// export

/**
 * Find the merge base for a set of commits
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string[]} args.oids - Which commits
 * @param {object} [args.cache] - a [cache](cache.md) object
 */
export async function findMergeBase({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  oids
}: FindMergeBaseOptions): Promise<string[]> {
  try {
    assertParameter("fs", _fs);
    const fs = adaptFileSystem(new FileSystem(_fs));

    assertParameter("gitdir", gitdir);
    assertParameter("oids", oids);

    return await _findMergeBase({
      cache,
      fs,
      gitdir,
      oids
    });
  } catch(err: unknown) {
    (err as any).caller = "git.findMergeBase";
    throw err;
  }
}

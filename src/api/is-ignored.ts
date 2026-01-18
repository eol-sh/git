/**
 * @fileoverview Git is-ignored API - High-level user interface
 *
 * This module provides the public API for is-ignored operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/is-ignored.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { GitIgnoreManager } from "../managers/git-ignore.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface IsIgnoredOptions {
  dir: string;
  filepath: string;
  fs: FsClient;
  gitdir?: string;
}



//// export

/**
 * Test whether a filepath should be ignored (because of .gitignore or .git/exclude)
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, ".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - The filepath to test
 *
 * @returns {Promise<boolean>} Resolves to true if the file should be ignored
 *
 * @example
 * await git.isIgnored({ fs, dir: "/tutorial", filepath: "docs/add.md" })
 */
export function isIgnored({
  dir,
  filepath,
  fs,
  gitdir = join(dir, ".git")
}: IsIgnoredOptions): Promise<boolean> {
  try {
    assertParameter("fs", fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const unifiedFs = adaptFsInterface(fs);

    return GitIgnoreManager.isIgnored({
      dir,
      filepath,
      fs: unifiedFs,
      gitdir
    });
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.isIgnored";
    throw error;
  }
}




/**
 * @fileoverview Git init API - Initialize new Git repositories
 * 
 * This module provides the high-level API for initializing new Git repositories.
 * It supports both bare and non-bare repositories with configurable default branch names.
 * 
 * @module api/init
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { _init } from "../commands/init.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

/**
 * Configuration options for initializing a Git repository
 * 
 * @interface InitOptions
 */
interface InitOptions {
  /** Create a bare repository (no working directory) */
  bare?: boolean;
  /** Name of the default branch (defaults to "primary") */
  defaultBranch?: string;
  /** Working directory path (required for non-bare repositories) */
  dir?: string;
  /** File system implementation (required) */
  fs: FsClient;
  /** Git directory path (defaults to `${dir}/.git` for non-bare, or `dir` for bare) */
  gitdir?: string;
}



//// export

/**
 * Initialize a new Git repository
 * 
 * Creates a new Git repository by setting up the basic directory structure,
 * configuration files, and initial references. Supports both bare and non-bare
 * repository types with customizable default branch names.
 *
 * @param {Object} options - Repository initialization options
 * @param {boolean} [options.bare=false] - Create a bare repository (no working directory)
 * @param {string} [options.defaultBranch="primary"] - Name of the default branch
 * @param {string} [options.dir] - Working directory path (required for non-bare repositories)
 * @param {FsClient} options.fs - File system implementation (required)
 * @param {string} [options.gitdir] - Git directory path (auto-calculated if not provided)
 * 
 * @returns {Promise<void>} Promise that resolves when repository is initialized
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {Error} When file system operations fail
 * @throws {Error} When directory already contains a Git repository
 * 
 * @example
 * ```typescript
 * import { init } from '@eol/git'
 * import fs from 'fs'
 * 
 * // Initialize a regular repository
 * await init({
 *   fs,
 *   dir: '/path/to/new-repo'
 * })
 * 
 * // Initialize a bare repository
 * await init({
 *   fs,
 *   dir: '/path/to/bare-repo.git',
 *   bare: true
 * })
 * 
 * // Initialize with custom default branch
 * await init({
 *   fs,
 *   dir: '/path/to/repo',
 *   defaultBranch: 'main'
 * })
 * ```
 * 
 * @see {@link https://git-scm.com/docs/git-init} Git init documentation
 * @since 1.0.0
 */
export async function init({
  bare = false,
  defaultBranch = "primary",
  dir,
  fs: _fs,
  gitdir = bare ?
    dir :
    join(dir!, ".git")
}: InitOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);

    if (!bare)
      assertParameter("dir", dir);

    /*** Check if _fs is already a FileSystem instance ***/
    const fileSystem = _fs instanceof FileSystem ?
      _fs :
      new FileSystem(_fs);

    const fs = adaptFileSystem(fileSystem);

    return await _init({
      bare,
      defaultBranch,
      ...(dir !== undefined ? { dir } : {}),
      fs,
      ...(gitdir !== undefined ? { gitdir } : {})
    });
  } catch(err: unknown) {
    (err as any).caller = "git.init";
    throw err;
  }
}

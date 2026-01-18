


/**
 * @fileoverview Git add API - Stage files to the Git index
 * 
 * This module provides the high-level API for staging files to the Git index (staging area).
 * It handles file discovery, ignore patterns, parallel processing, and CRLF conversion.
 * 
 * @module api/add
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { _writeObject } from "../storage/write-object.ts";
import { adaptFileSystem, adaptFsForGitConfig, adaptFsInterfaceForGitIndex } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { Cache, FsClient } from "../types.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import { GitIgnoreManager } from "../managers/git-ignore.ts";
import { GitIndex } from "../models/git-index.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { join } from "../utils/join.ts";
import { MultipleGitError } from "../errors/multiple-git.ts";
import { normalizeStats } from "../utils/normalize-stats.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { posixifyPathBuffer } from "../utils/posixify-path-buffer.ts";

/**
 * Configuration options for adding files to the Git index
 * 
 * @interface AddOptions
 */
interface AddOptions {
  /** Cache for performance optimization */
  cache?: Cache;
  /** Working directory path */
  dir: string;
  /** File or directory path(s) to add to the index */
  filepath: string | string[];
  /** Force adding ignored files */
  force?: boolean;
  /** File system implementation (required) */
  fs: FsClient;
  /** Git directory path (defaults to `${dir}/.git`) */
  gitdir?: string;
  /** Process files in parallel for better performance */
  parallel?: boolean;
}

/**
 * Internal options for the addToIndex helper function
 * 
 * @interface AddToIndexOptions
 * @internal
 */
interface AddToIndexOptions {
  /** Automatic CRLF conversion setting */
  autocrlf: boolean | string | undefined;
  /** Working directory path */
  dir: string;
  /** File or directory path(s) to add to the index */
  filepath: string | string[];
  /** Force adding ignored files */
  force: boolean;
  /** File system implementation */
  fs: FileSystem;
  /** Git directory path */
  gitdir: string;
  /** Git index instance */
  index: GitIndex;
  /** Process files in parallel */
  parallel: boolean;
  /** Unified file system interface */
  unifiedFs: any;
}



//// export

/**
 * Add files to the Git index (staging area)
 * 
 * Stages files or directories for the next commit. This function reads files from
 * the working directory, creates blob objects, and updates the Git index. It handles
 * ignored files, parallel processing, and automatic line ending conversion.
 *
 * @param {Object} options - Add operation configuration
 * @param {Cache} [options.cache] - Cache for performance optimization
 * @param {string} options.dir - Working directory path
 * @param {string|string[]} options.filepath - File or directory path(s) to stage
 * @param {boolean} [options.force=false] - Force adding ignored files
 * @param {FsClient} options.fs - File system implementation (required)
 * @param {string} [options.gitdir] - Git directory path (defaults to `${dir}/.git`)
 * @param {boolean} [options.parallel=true] - Process files in parallel for better performance
 * 
 * @returns {Promise<void>} Promise that resolves when files are staged
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {NotFoundError} When specified file(s) don't exist
 * @throws {MultipleGitError} When multiple errors occur during parallel processing
 * @throws {Error} When file system operations fail
 * 
 * @example
 * ```typescript
 * import { add } from '@eol/git'
 * import fs from 'fs'
 * 
 * // Add a single file
 * await add({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: 'src/index.ts'
 * })
 * 
 * // Add multiple files
 * await add({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: ['src/file1.ts', 'src/file2.ts']
 * })
 * 
 * // Add entire directory
 * await add({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: 'src/'
 * })
 * 
 * // Force add ignored files
 * await add({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: 'build/output.js',
 *   force: true
 * })
 * ```
 * 
 * @see {@link https://git-scm.com/docs/git-add} Git add documentation
 * @since 1.0.0
 */
export async function add({
  cache = new Map(),
  dir,
  filepath,
  force = false,
  fs: _fs,
  gitdir = join(dir, ".git"),
  parallel = true
}: AddOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const fileSystem = new FileSystem(_fs);
    const fs = adaptFileSystem(fileSystem);
    const unifiedFs = adaptFsForGitConfig(fileSystem);

    await GitIndexManager.acquire({ cache, fs: adaptFsInterfaceForGitIndex(fs), gitdir }, async(index) => {
      const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });
      const autocrlf = await config.get("core.autocrlf") as boolean | string | undefined;

      return addToIndex({
        autocrlf,
        dir,
        filepath,
        force,
        fs: fileSystem,
        gitdir,
        index,
        parallel,
        unifiedFs
      });
    });
  } catch(err: unknown) {
    (err as any).caller = "git.add";
    throw err;
  }
}



//// helper

/**
 * Internal helper function to add files to the Git index
 * 
 * Handles the actual file processing, including ignore checking, directory traversal,
 * blob creation, and index updates. Supports both parallel and sequential processing.
 *
 * @param {AddToIndexOptions} options - Internal add operation configuration
 * @returns {Promise<any[]>} Array of fulfilled promises
 * 
 * @throws {NotFoundError} When files don't exist
 * @throws {MultipleGitError} When multiple errors occur during parallel processing
 * 
 * @internal
 */
async function addToIndex({
  autocrlf,
  dir,
  filepath,
  force,
  fs,
  gitdir,
  index,
  parallel,
  unifiedFs
}: AddToIndexOptions): Promise<any[]> {
  /*** Check ignore status: files should be ignored UNLESS they’re already in the index or force is used ***/
  const filepaths = Array.isArray(filepath) ? filepath : [filepath];

  const promises = filepaths.map(async(currentFilepath) => {
    if (!force) {
      const ignored = await GitIgnoreManager.isIgnored({
        dir,
        filepath: currentFilepath,
        fs: unifiedFs,
        gitdir
      });

      /*** If the file is ignored, only skip it if it’s not already in the index ***/
      if (ignored) {
        const alreadyInIndex = index.has({ filepath: currentFilepath });

        if (!alreadyInIndex)
          return; /*** Skip ignored files that aren’t already tracked ***/

        /*** If file is in index but ignored, still add it (git behavior) ***/
      }
    }

    const stats = await fs.lstat(join(dir, currentFilepath));

    if (!stats)
      throw new NotFoundError(currentFilepath);

    if (stats.isDirectory()) {
      const children = await fs.readdir(join(dir, currentFilepath));

      if (!children)
        return;

      if (parallel) {
        const promises = children.map((child) =>
          addToIndex({
            autocrlf,
            dir,
            filepath: [join(currentFilepath, child)],
            force,
            fs,
            gitdir,
            index,
            parallel,
            unifiedFs
          })
        );

        await Promise.all(promises);
      } else {
        for (const child of children) {
          await addToIndex({
            autocrlf,
            dir,
            filepath: [join(currentFilepath, child)],
            force,
            fs,
            gitdir,
            index,
            parallel,
            unifiedFs
          });
        }
      }
    } else {
      const object = stats.isSymbolicLink() ?
        await fs.readlink(join(dir, currentFilepath)).then(result => result ? posixifyPathBuffer(result) : new Uint8Array()) :
        await fs.read(join(dir, currentFilepath), typeof autocrlf === "string" ? { autocrlf } : {});

      if (object === null)
        throw new NotFoundError(currentFilepath);

      const objectBuffer = typeof object === "string" ?
        new TextEncoder().encode(object) :
        object;

      const oid = await _writeObject({ fs: adaptFileSystem(fs), gitdir, object: objectBuffer, type: "blob" });

      const normalizedStats = normalizeStats({
        ...stats,
        dev: stats.dev ?? 0,
        gid: stats.gid ?? 0,
        ino: stats.ino ?? 0,
        uid: stats.uid ?? 0
      });

      index.insert({ filepath: currentFilepath, oid, stats: normalizedStats });
    }
  });

  const settledPromises = await Promise.allSettled(promises);

  const rejectedPromises = settledPromises
    .filter((settle): settle is PromiseRejectedResult => settle.status === "rejected")
    .map((settle) => settle.reason);

  if (rejectedPromises.length > 1)
    throw new MultipleGitError(rejectedPromises);

  if (rejectedPromises.length === 1)
    throw rejectedPromises[0];

  const fulfilledPromises = settledPromises
    .filter((settle): settle is PromiseFulfilledResult<any> => settle.status === "fulfilled" && settle.value !== undefined)
    .map((settle) => settle.value);

  return fulfilledPromises;
}

/**
 * @fileoverview Git status API - High-level user interface
 *
 * This module provides the public API for status operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/status.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _readObject } from "../storage/read-object.ts";
import { _readTree } from "../commands/read-tree.ts";
import { adaptFileSystem, adaptFsForGitIgnore, adaptFsForGitRef, adaptFsInterfaceForGitIndex } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { compareStats } from "../utils/compare-stats.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIgnoreManager } from "../managers/git-ignore.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitTree } from "../models/git-tree.ts";
import { hashObject } from "../utils/hash-object.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { ObjectTypeError } from "../errors/object-type.ts";

import type { Cache, FsClient, FsInterface, TreeEntry } from "../types.ts";

type StatusResult =
  | "*absent"
  | "*added"
  | "*deleted"
  | "*modified"
  | "*undeleted"
  | "*undeletemodified"
  | "*unmodified"
  | "absent"
  | "added"
  | "deleted"
  | "ignored"
  | "modified"
  | "unmodified";

/**
 * Configuration options for checking file status
 * 
 * @interface StatusOptions
 */
interface StatusOptions {
  /** Cache for performance optimization */
  cache?: Cache;
  /** Working directory path */
  dir: string;
  /** File path to check status for */
  filepath: string;
  /** File system implementation (required) */
  fs: FsClient;
  /** Git directory path (defaults to `${dir}/.git`) */
  gitdir?: string;
}

/**
 * Represents an entry in the Git index
 * 
 * @interface IndexEntry
 * @internal
 */
interface IndexEntry {
  /** File path relative to repository root */
  path: string;
  /** SHA-1 hash of the file content */
  oid: string;
  /** File statistics for cache optimization */
  stats?: any;
}



//// export

/**
 * Check the status of a file in the Git repository
 * 
 * Determines whether a file has been modified, added, deleted, or is untracked
 * by comparing the working directory, Git index (staging area), and HEAD commit.
 * This is the core function behind `git status` for individual files.
 *
 * @param {Object} options - Status check configuration
 * @param {Cache} [options.cache] - Cache for performance optimization
 * @param {string} options.dir - Working directory path
 * @param {string} options.filepath - File path to check status for
 * @param {FsClient} options.fs - File system implementation (required)
 * @param {string} [options.gitdir] - Git directory path (defaults to `${dir}/.git`)
 * 
 * @returns {Promise<StatusResult>} File status indicating changes between working dir, index, and HEAD
 * 
 * **Return values:**
 * - `"unmodified"` - File unchanged from HEAD
 * - `"modified"` - File changed in working directory and staged
 * - `"*modified"` - File changed in working directory but not staged  
 * - `"added"` - New file staged for commit
 * - `"*added"` - New file in working directory but not staged
 * - `"deleted"` - File removed and staged for removal
 * - `"*deleted"` - File removed from working directory but not staged
 * - `"absent"` - File doesn't exist anywhere
 * - `"ignored"` - File is ignored by .gitignore rules
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {Error} When file system operations fail
 * @throws {NotFoundError} When Git repository is not found
 * @throws {ObjectTypeError} When Git objects have unexpected types
 * 
 * @example
 * ```typescript
 * import { status } from '@eol/git'
 * import fs from 'fs'
 * 
 * // Check status of a specific file
 * const fileStatus = await status({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: 'src/index.ts'
 * })
 * 
 * console.log(`File status: ${fileStatus}`)
 * // => "modified", "unmodified", "added", etc.
 * 
 * // Check multiple files
 * const files = ['README.md', 'package.json', 'src/app.ts']
 * for (const filepath of files) {
 *   const status = await status({
 *     fs,
 *     dir: '/path/to/repo', 
 *     filepath
 *   })
 *   console.log(`${filepath}: ${status}`)
 * }
 * 
 * // Handle ignored files
 * const status = await status({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: 'node_modules/some-package/index.js'
 * })
 * if (status === 'ignored') {
 *   console.log('File is ignored by .gitignore')
 * }
 * ```
 * 
 * @see {@link https://git-scm.com/docs/git-status} Git status documentation
 * @since 1.0.0
 */
export async function status({
  cache = new Map(),
  dir,
  filepath,
  fs: _fs,
  gitdir = join(dir, ".git")
}: StatusOptions): Promise<StatusResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const fileSystem = new FileSystem(_fs);
    const unifiedFs = adaptFileSystem(fileSystem);
    const ignoreFs = adaptFsForGitIgnore(fileSystem);
    const refFs = adaptFsForGitRef(fileSystem);

    const ignored = await GitIgnoreManager.isIgnored({
      dir,
      filepath,
      fs: ignoreFs,
      gitdir
    });

    if (ignored)
      return "ignored";

    const headTree = await getHeadTree({ cache, gitdir, refFs, unifiedFs });

    const treeOid = await getOidAtPath({
      cache,
      gitdir,
      path: filepath,
      tree: headTree,
      unifiedFs
    });

    const indexEntry = await GitIndexManager.acquire(
      { cache, fs: adaptFsInterfaceForGitIndex(_fs), gitdir },
      (index: any): IndexEntry | null => {
        for (const entry of index) {
          if (entry.path === filepath)
            return entry;
        }

        return null;
      }
    );

    const stats = await fileSystem.lstat(join(dir, filepath));
    const H = treeOid !== null;    /*** head ***/
    const I = indexEntry !== null; /*** index ***/
    const W = stats !== null;      /*** working dir ***/

    const getWorkdirOid = async(): Promise<string> => {
      if (I && indexEntry && stats && indexEntry.stats && !compareStats(indexEntry.stats, stats as any)) {
        return indexEntry.oid;
      } else {
        const object = await fileSystem.read(join(dir, filepath));

        if (!object)
          throw new Error(`Unable to read file: ${filepath}`);

        const buffer = typeof object === "string" ?
          new TextEncoder().encode(object) :
          object;

        const workdirOid = await hashObject({ gitdir, object: buffer, type: "blob" });

        /*** If the oid in the index === working dir oid but stats differed update cache ***/
        if (I && indexEntry && indexEntry.oid === workdirOid) {
          /*** and as long as our fs.stats aren’t bad.
          size of -1 happens over a BrowserFS HTTP Backend that doesn’t serve Content-Length headers
          (like the Karma webserver) because BrowserFS HTTP Backend uses HTTP HEAD requests to do fs.stat ***/
          if (stats && stats.size !== -1) {
            /*** We don’t await this so we can return faster for one-off cases. ***/
            GitIndexManager.acquire({ cache, fs: adaptFsInterfaceForGitIndex(_fs), gitdir }, (index: any) => {
              index.insert({ filepath, oid: workdirOid, stats });
            });
          }
        }

        return workdirOid;
      }
    };

    if (!H && !W && !I)
      return "absent";  /*** --- ***/

    if (!H && !W && I)
      return "*absent"; /*** -A- ***/

    if (!H && W && !I)
      return "*added";  /*** --A ***/

    if (!H && W && I) {
      const workdirOid = await getWorkdirOid();

      return workdirOid === indexEntry!.oid ?
        "added" :
        "*added"; /*** -AA : -AB ***/
    }

    if (H && !W && !I)
      return "deleted"; /*** A-- ***/

    if (H && !W && I) {
      return treeOid === indexEntry!.oid ?
        "*deleted" :
        "*deleted"; /*** AA- : AB- ***/
    }

    if (H && W && !I) {
      const workdirOid = await getWorkdirOid();

      return workdirOid === treeOid ?
        "*undeleted" :
        "*undeletemodified"; /*** A-A : A-B ***/
    }

    if (H && W && I) {
      const workdirOid = await getWorkdirOid();

      if (workdirOid === treeOid) {
        return workdirOid === indexEntry!.oid ?
          "unmodified" :
          "*unmodified"; /*** AAA : ABA ***/
      } else {
        return workdirOid === indexEntry!.oid ?
          "modified" :
          "*modified"; /*** ABB : AAB ***/
      }
    }

    /*** Should never reach here ***/
    throw new Error("Unexpected status calculation state");
  } catch(err: unknown) {
    (err as any).caller = "git.status";
    throw err;
  }
}



//// helper

/**
 * Get the tree entries from the current HEAD commit
 * 
 * @param {Object} options - Configuration for retrieving HEAD tree
 * @returns {Promise<TreeEntry[]>} Array of tree entries from HEAD commit, empty array if no commits
 * 
 * @internal
 */
async function getHeadTree({
  cache,
  gitdir,
  refFs,
  unifiedFs
}: {
  cache: Cache;
  gitdir: string;
  refFs: any;
  unifiedFs: FsInterface;
}): Promise<TreeEntry[]> {
  /*** Get the tree from the HEAD commit. ***/
  let oid: string;

  try {
    oid = await GitRefManager.resolve({ fs: refFs, gitdir, ref: "HEAD" });
  } catch(e) {
    /*** Handle fresh branches with no commits ***/
    if (e instanceof NotFoundError)
      return [];

    throw e;
  }

  const { tree } = await _readTree({ cache, fs: unifiedFs, gitdir, oid });
  return tree;
}

async function getOidAtPath({
  cache,
  gitdir,
  path,
  tree,
  unifiedFs
}: {
  cache: Cache;
  gitdir: string;
  path: string | string[];
  tree: TreeEntry[];
  unifiedFs: FsInterface;
}): Promise<string | null> {
  const pathArray = typeof path === "string" ?
    path.split("/") :
    path;

  const dirname = pathArray.shift();

  for (const entry of tree) {
    if (entry.path === dirname) {
      if (pathArray.length === 0)
        return entry.oid;

      const { object, type } = await _readObject({
        cache,
        fs: unifiedFs,
        gitdir,
        oid: entry.oid
      });

      if (type === "tree") {
        const tree = GitTree.from(object);

        return getOidAtPath({
          cache,
          gitdir,
          path: pathArray,
          tree: tree.entries(),
          unifiedFs
        });
      }

      if (type === "blob")
        throw new ObjectTypeError(entry.oid, type, "blob", pathArray.join("/"));
    }
  }

  return null;
}

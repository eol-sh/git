/**
 * @fileoverview Git status-matrix API - High-level user interface
 *
 * This module provides the public API for status-matrix operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/status-matrix.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _walk } from "../commands/walk.ts";
import { adaptFileSystem, adaptFsForGitIgnore } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIgnoreManager } from "../managers/git-ignore.ts";
import { join } from "../utils/join.ts";
import { STAGE } from "../commands/stage.ts";
import { TREE } from "../commands/tree.ts";
import { WORKDIR } from "../commands/workdir.ts";
import { worthWalking } from "../utils/worth-walking.ts";

import type { Cache, FsInterface, StatusRow } from "../types.ts";



//// export

export interface StatusMatrixOptions {
  cache?: Cache;
  dir: string;
  filepaths?: string[];
  filter?: (filename: string) => boolean;
  fs: FsInterface;
  gitdir?: string;
  ignored?: boolean;
  ref?: string;
  trees?: Array<any>; // Allow custom trees beyond the default HEAD, WORKDIR, STAGE
}

/**
 * Efficiently get the status of multiple files at once.
 *
 * The returned `StatusMatrix` is admittedly not the easiest format to read.
 * However it conveys a large amount of information in dense format that should make it easy to create reports about the current state of the repository;
 * without having to do multiple, time-consuming @eol/git calls.
 * My hope is that the speed and flexibility of the function will make up for the learning curve of interpreting the return value.
 *
 * ```js live
 * // get the status of all the files in "src"
 * let status = await git.statusMatrix({
 *   dir: "/tutorial",
 *   filter: f => f.startsWith("src/"),
 *   fs
 * });
 * console.log(status);
 * ```
 *
 * ```js live
 * // get the status of all the JSON and Markdown files
 * let status = await git.statusMatrix({
 *   dir: "/tutorial",
 *   filter: f => f.endsWith(".json") || f.endsWith(".md"),
 *   fs
 * });
 * console.log(status);
 * ```
 *
 * The result is returned as a 2D array.
 * The outer array represents the files and/or blobs in the repo, in alphabetical order.
 * The inner arrays describe the status of the file:
 * the first value is the filepath, and the next three are integers
 * representing the HEAD status, WORKDIR status, and STAGE status of the entry.
 *
 * ```js
 * // example StatusMatrix
 * [
 *   ["a.txt", 0, 2, 0], // new, untracked
 *   ["b.txt", 0, 2, 2], // added, staged
 *   ["c.txt", 0, 2, 3], // added, staged, with unstaged changes
 *   ["d.txt", 1, 1, 1], // unmodified
 *   ["e.txt", 1, 2, 1], // modified, unstaged
 *   ["f.txt", 1, 2, 2], // modified, staged
 *   ["g.txt", 1, 2, 3], // modified, staged, with unstaged changes
 *   ["h.txt", 1, 0, 1], // deleted, unstaged
 *   ["i.txt", 1, 0, 0], // deleted, staged
 *   ["j.txt", 1, 2, 0], // deleted, staged, with unstaged-modified changes (new file of the same name)
 *   ["k.txt", 1, 1, 0], // deleted, staged, with unstaged changes (new file of the same name)
 * ]
 * ```
 *
 * - The HEAD status is either absent (0) or present (1).
 * - The WORKDIR status is either absent (0), identical to HEAD (1), or different from HEAD (2).
 * - The STAGE status is either absent (0), identical to HEAD (1), identical to WORKDIR (2), or different from WORKDIR (3).
 *
 * ```ts
 * type Filename      = string
 * type HeadStatus    = 0 | 1
 * type WorkdirStatus = 0 | 1 | 2
 * type StageStatus   = 0 | 1 | 2 | 3
 *
 * type StatusRow     = [Filename, HeadStatus, WorkdirStatus, StageStatus]
 *
 * type StatusMatrix  = StatusRow[]
 * ```
 *
 * > Think of the natural progression of file modifications as being from HEAD (previous) -> WORKDIR (current) -> STAGE (next).
 * > Then HEAD is "version 1", WORKDIR is "version 2", and STAGE is "version 3".
 * > Then, imagine a "version 0" which is before the file was created.
 * > Then the status value in each column corresponds to the oldest version of the file it is identical to.
 * > (For a file to be identical to "version 0" means the file is deleted.)
 *
 * Here are some examples of queries you can answer using the result:
 *
 * #### Q: What files have been deleted?
 * ```js
 * const FILE = 0, WORKDIR = 2;
 *
 * const filenames = (await statusMatrix({ dir }))
 *   .filter(row => row[WORKDIR] === 0)
 *   .map(row => row[FILE]);
 * ```
 *
 * #### Q: What files have unstaged changes?
 * ```js
 * const FILE = 0, WORKDIR = 2, STAGE = 3;
 *
 * const filenames = (await statusMatrix({ dir }))
 *   .filter(row => row[WORKDIR] !== row[STAGE])
 *   .map(row => row[FILE]);
 * ```
 *
 * #### Q: What files have been modified since the last commit?
 * ```js
 * const FILE = 0, HEAD = 1, WORKDIR = 2;
 *
 * const filenames = (await statusMatrix({ dir }))
 *   .filter(row => row[HEAD] !== row[WORKDIR])
 *   .map(row => row[FILE]);
 * ```
 *
 * #### Q: What files will NOT be changed if I commit right now?
 * ```js
 * const FILE = 0, HEAD = 1, STAGE = 3;
 *
 * const filenames = (await statusMatrix({ dir }))
 *   .filter(row => row[HEAD] === row[STAGE])
 *   .map(row => row[FILE]);
 * ```
 *
 * For reference, here are all possible combinations:
 *
 * | HEAD | WORKDIR | STAGE | `git status --short` equivalent |
 * | ---- | ------- | ----- | ------------------------------- |
 * | 0    | 0       | 0     | ``                              |
 * | 0    | 0       | 3     | `AD`                            |
 * | 0    | 2       | 0     | `??`                            |
 * | 0    | 2       | 2     | `A `                            |
 * | 0    | 2       | 3     | `AM`                            |
 * | 1    | 0       | 0     | `D `                            |
 * | 1    | 0       | 1     | ` D`                            |
 * | 1    | 0       | 3     | `MD`                            |
 * | 1    | 1       | 0     | `D ` + `??`                     |
 * | 1    | 1       | 1     | ``                              |
 * | 1    | 1       | 3     | `MM`                            |
 * | 1    | 2       | 0     | `D ` + `??`                     |
 * | 1    | 2       | 1     | ` M`                            |
 * | 1    | 2       | 2     | `M `                            |
 * | 1    | 2       | 3     | `MM`                            |
 *
 * @param args - The options for statusMatrix
 * @param args.fs - a file system client
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.ref - Optionally specify a different commit to compare against the workdir and stage instead of the HEAD
 * @param args.filepaths - Limit the query to the given files and directories
 * @param args.filter - Filter the results to only those whose filepath matches a function.
 * @param args.cache - a [cache](cache.md) object
 * @param args.ignored - include ignored files in the result
 * @param args.trees - Optionally specify custom trees for comparison (defaults to [TREE(ref), WORKDIR(), STAGE()])
 *
 * @returns Resolves with a status matrix, described below.
 * @see StatusRow
 */
export async function statusMatrix({
  cache = new Map(),
  dir,
  filepaths = ["."],
  filter,
  fs: _fs,
  gitdir = join(dir, ".git"),
  ignored: shouldIgnore = false,
  ref = "HEAD",
  trees
}: StatusMatrixOptions): Promise<StatusRow[]> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);

    const fileSystem = new FileSystem(_fs);
    const fs = adaptFileSystem(fileSystem);
    const ignoreFs = adaptFsForGitIgnore(fileSystem);

    // Use provided trees or default to the standard 3-tree comparison
    const treesToUse = trees || [TREE({ ref }), WORKDIR(), STAGE()];
    const isStandardThreeTrees = !trees && treesToUse.length === 3;

    return (await _walk({
      cache,
      dir,
      fs,
      gitdir,
      map: async(filepath, treeEntries) => {
        // For backward compatibility, handle standard 3-tree case
        if (isStandardThreeTrees) {
          const [head, workdir, stage] = treeEntries;
          
          /*** Ignore ignored files, but only if they are not already tracked. ***/
          if (!head && !stage && workdir) {
            if (!shouldIgnore) {
              const isIgnored = await GitIgnoreManager.isIgnored({
                dir,
                filepath,
                fs: ignoreFs,
                gitdir
              });

              if (isIgnored)
                return null;
            }
          }

          /*** match against base paths ***/
          if (!filepaths.some((base) => worthWalking(filepath, base)))
            return null;

          /*** Late filter against file names ***/
          if (filter) {
            if (!filter(filepath))
              return;
          }

          const [headType, workdirType, stageType] = await Promise.all([
            head && head.type(),
            workdir && workdir.type(),
            stage && stage.type()
          ]);

          const isBlob = [headType, workdirType, stageType].includes("blob");

          /*** For now, bail on directories unless the file is also a blob in another tree ***/
          if ((headType === "tree" || headType === "special") && !isBlob)
            return;

          if (headType === "commit")
            return null;

          if ((workdirType === "tree" || workdirType === "special") && !isBlob)
            return;

          if (stageType === "commit")
            return null;

          if ((stageType === "tree" || stageType === "special") && !isBlob)
            return;

          /*** Figure out the oids for files ***/
          const headOid = headType === "blob" && head ? await head.oid() : undefined;
          const stageOid = stageType === "blob" && stage ? await stage.oid() : undefined;

          let workdirOid;
          if (headType !== "blob" && workdirType === "blob" && stageType !== "blob") {
            // Enhanced logic: can now handle N trees dynamically
            workdirOid = "42";
          } else if (workdirType === "blob" && workdir) {
            workdirOid = await workdir.oid();
          }

          const entry = [undefined, headOid, workdirOid, stageOid];
          const result = entry.map((value) => entry.indexOf(value));
          result.shift(); 
          return [filepath, ...result] as StatusRow;
        } 
        
        // Handle N trees case
        else {
          /*** match against base paths ***/
          if (!filepaths.some((base) => worthWalking(filepath, base)))
            return null;

          /*** Late filter against file names ***/
          if (filter) {
            if (!filter(filepath))
              return;
          }

          // Get types and oids for all trees
          const types = await Promise.all(
            treeEntries.map(entry => entry && entry.type())
          );
          
          const isBlob = types.includes("blob");

          // Skip if all entries are directories/special and no blobs
          if (types.every(type => type === "tree" || type === "special") && !isBlob)
            return;

          // Skip commits
          if (types.includes("commit"))
            return null;

          // Get oids for all trees
          const oids = await Promise.all(
            treeEntries.map(async (entry, i) => 
              types[i] === "blob" && entry ? await entry.oid() : undefined
            )
          );

          // For N-tree case, create a more generic comparison
          const entry = [undefined, ...oids];
          const result = entry.map((value) => entry.indexOf(value));
          result.shift();
          return [filepath, ...result] as StatusRow;
        }
      },
      trees: treesToUse
    })) as StatusRow[];
  } catch(err: unknown) {
    (err as any).caller = "git.statusMatrix";
    throw err;
  }
}

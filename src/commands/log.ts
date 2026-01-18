


//// util

import { _readCommit } from "./read-commit.ts";
import { _readTree } from "./read-tree.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { compareAge } from "../utils/compare-age.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitShallowManager } from "../managers/git-shallow.ts";
import { resolveFilepath } from "../utils/resolve-filepath.ts";
import { FileSystem } from "../models/file-system.ts";

import type { Cache, FsInterface, ReadCommitResult } from "../types.ts";

interface LogOptions {
  cache: Cache;
  depth?: number;
  filepath?: string;
  follow?: boolean;
  force?: boolean;
  fs: FsInterface;
  gitdir: string;
  ref: string;
  since?: Date;
  until?: Date;
}



//// export

/**
 * Async generator version that yields commits one at a time for memory efficiency
 */
export async function* _logGenerator({
  cache,
  depth,
  filepath,
  follow = false,
  fs,
  gitdir,
  ref = "HEAD",
  since,
  until
}: LogOptions): AsyncGenerator<ReadCommitResult, void, unknown> {
  const unifiedFs = adaptFsInterface(fs);

  const sinceTimestamp = typeof since === "undefined" ?
    undefined :
    Math.floor(since.valueOf() / 1000);

  const untilTimestamp = typeof until === "undefined" ?
    undefined :
    Math.floor(until.valueOf() / 1000);

  const commitsCount = { count: 0 };
  const shallowCommits = await GitShallowManager.read({ fs, gitdir });
  const oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });
  const tips = [await _readCommit({ cache, fs, gitdir, oid })];

  let isOk = false;
  let lastCommit: ReadCommitResult | undefined;
  let lastFileOid: string | undefined;

  while (tips.length > 0) {
    const commit = tips.pop()!;

    /*** Apply all the filters ***/
    if (depth !== undefined && commitsCount.count >= depth)
      break;

    if (
      sinceTimestamp !== undefined &&
      commit.commit.committer.timestamp <= sinceTimestamp
    ) break;

    if (
      untilTimestamp !== undefined &&
      commit.commit.committer.timestamp >= untilTimestamp
    ) continue;

    if (filepath) {
      let hasFile = false;

      try {
        const fileOid = await resolveFilepath({ cache, filepath, fs, gitdir, oid: commit.commit.tree });
        hasFile = true;
        lastFileOid = fileOid; // Track the file OID for rename detection
      } catch {
        hasFile = false;
      }

      if (follow && lastCommit && lastFileOid) {
        // File following logic: detect if file was renamed/moved
        if (!hasFile) {
          // File doesn't exist at current path, check if it was renamed
          const renamedPath = await detectFileRename({
            cache,
            fs: fs as any,
            gitdir,
            fromCommit: commit.commit,
            toCommit: lastCommit.commit,
            targetOid: lastFileOid,
            originalPath: filepath
          });

          if (renamedPath) {
            // Update filepath to follow the rename
            filepath = renamedPath;
            hasFile = true;
          }
        }
      }

      if (!hasFile && !isOk)
        continue;

      isOk = hasFile;
    }

    commitsCount.count++;
    yield commit; /*** Yield each commit as we process it ***/

    // Update lastCommit for file following
    lastCommit = commit;

    /*** Add parents to tips for continued processing ***/
    if (!shallowCommits.has(commit.oid)) {
      for (const parent of commit.commit.parent) {
        try {
          const parentCommit = await _readCommit({ cache, fs, gitdir, oid: parent });
          tips.push(parentCommit);
        } catch {
          /*** Skip missing parents ***/
        }
      }
    }

    /*** Process tips in order by age ***/
    tips.sort((a, b) => compareAge(a.commit, b.commit));
  }
}

/**
 * Detect if a file was renamed between two commits by comparing file OIDs
 */
async function detectFileRename({
  // cache,
  fs,
  gitdir,
  fromCommit,
  // toCommit,
  targetOid,
  originalPath
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  fromCommit: any;
  toCommit: any;
  targetOid: string;
  originalPath: string;
}): Promise<string | null> {
  try {
    // Get trees for both commits
    const fromTree = await _readTree({ fs: fs as any, gitdir, oid: fromCommit.tree });
    // const toTree = await _readTree({ fs: fs as any, gitdir, oid: toCommit.tree });

    // Flatten both trees to get all file paths and OIDs
    const fromFiles = await flattenTreeForRename(fromTree, fs, gitdir);
    // const toFiles = await flattenTreeForRename(toTree, fs, gitdir);

    // Find files with the target OID in the 'from' commit
    const candidatePaths: string[] = [];
    for (const [path, oid] of fromFiles) {
      if (oid === targetOid && path !== originalPath)
        candidatePaths.push(path);
    }

    // Return the first candidate (simple heuristic)
    // In a more sophisticated implementation, we'd use similarity scoring
    return candidatePaths[0] || null;
  } catch {
    return null;
  }
}

/**
 * Flatten tree for rename detection
 */
async function flattenTreeForRename(
  tree: any,
  fs: FileSystem,
  gitdir: string,
  prefix = ""
): Promise<Map<string, string>> {
  const files = new Map<string, string>();

  for (const entry of tree.entries()) {
    const filepath = prefix ? `${prefix}/${entry.path}` : entry.path;

    if (entry.type === "tree") {
      const subtree = await _readTree({ fs: fs as any, gitdir, oid: entry.oid });
      const subFiles = await flattenTreeForRename(subtree, fs, gitdir, filepath);
      for (const [path, oid] of subFiles) {
        files.set(path, oid);
      }
    } else if (entry.type === "blob") {
      files.set(filepath, entry.oid);
    }
  }

  return files;
}

/**
 * Original function that collects all commits into an array
 */
export async function _log({
  cache,
  depth,
  filepath,
  follow = false,
  fs,
  gitdir,
  ref,
  since,
  until
}: LogOptions): Promise<ReadCommitResult[]> {
  /*** Use the generator version and collect results ***/
  const commits: ReadCommitResult[] = [];

  for await (const commit of _logGenerator({
    cache,
    ...(depth !== undefined ? { depth } : {}),
    ...(filepath !== undefined ? { filepath } : {}),
    ...(follow !== undefined ? { follow } : {}),
    fs,
    gitdir,
    ref,
    ...(since !== undefined ? { since } : {}),
    ...(until !== undefined ? { until } : {})
  })) {
    commits.push(commit);
  }

  return commits;
}

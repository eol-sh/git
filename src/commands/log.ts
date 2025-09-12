


//// util

import { _readCommit } from "./read-commit.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { compareAge } from "../utils/compare-age.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitShallowManager } from "../managers/git-shallow.ts";
import { resolveFilepath } from "../utils/resolve-filepath.ts";

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
        await resolveFilepath({ cache, filepath, fs, gitdir, oid: commit.commit.tree,  });
        hasFile = true;
      } catch {
        hasFile = false;
      }

      if (follow && lastCommit && lastFileOid) {
        /*** Implementation of file following logic would go here
        For now, simplified version ***/
      }

      if (!hasFile && !isOk)
        continue;

      isOk = hasFile;
    }

    commitsCount.count++;
    yield commit; /*** Yield each commit as we process it ***/

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

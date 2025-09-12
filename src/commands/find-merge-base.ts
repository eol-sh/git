


//// util

import { GitCommit } from "../models/git-commit.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { Cache, FsInterface } from "../types.ts";

interface FindMergeBaseOptions {
  cache: Cache;
  fs: FsInterface;
  gitdir: string;
  oids: string[];
}

interface WalkerHead {
  index: number;
  oid: string;
}



//// export

export async function _findMergeBase({ cache, fs, gitdir, oids }: FindMergeBaseOptions): Promise<string[]> {
  /*** Note: right now, the tests are geared so that the output should match that of
  `git merge-base --all --octopus`
  because without the --octopus flag, git’s output seems to depend on the ORDER of the oids,
  and computing virtual merge bases is just too much for me to fathom right now.

  If we start N independent walkers, one at each of the given `oids`, and walk backwards
  through ancestors, eventually we’ll discover a commit where each one of these N walkers
  has passed through. So we just need to keep track of which walkers have visited each commit
  until we find a commit that N distinct walkers has visited. ***/
  const visits: Record<string, Set<number>> = {};
  const passes = oids.length;
  let heads: WalkerHead[] = oids.map((oid, index) => ({ index, oid }));

  while (heads.length) {
    /*** Count how many times we’ve passed each commit ***/
    const result = new Set<string>();

    for (const { oid, index } of heads) {
      if (!visits[oid])
        visits[oid] = new Set();

      visits[oid].add(index);

      if (visits[oid].size === passes)
        result.add(oid);
    }

    if (result.size > 0)
      return [...result];

    /*** We haven’t found a common ancestor yet ***/
    const newheads = new Map<string, WalkerHead>();

    for (const { index, oid } of heads) {
      try {
        const { object } = await readObject({ cache, fs, gitdir, oid });
        const commit = GitCommit.from(object);
        const { parent } = commit.parseHeaders();

        for (const parentOid of parent) {
          if (!visits[parentOid] || !visits[parentOid].has(index))
            newheads.set(parentOid + ":" + index, { index, oid: parentOid });
        }
      } catch {
        /*** do nothing ***/
      }
    }

    heads = Array.from(newheads.values());
  }

  return [];
}

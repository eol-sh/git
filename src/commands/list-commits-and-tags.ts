


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitShallowManager } from "../managers/git-shallow.ts";
import { join } from "../utils/join.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { Cache, FsInterface } from "../types.ts";

interface ListCommitsAndTagsOptions {
  cache: Cache;
  dir?: string;
  finish: Iterable<string>;
  fs: FsInterface;
  gitdir?: string;
  start: Iterable<string>;
}



//// export

export async function listCommitsAndTags({
  cache,
  dir,
  finish,
  fs,
  gitdir = join(dir!, ".git"),
  start
}: ListCommitsAndTagsOptions): Promise<Set<string>> {
  const unifiedFs = adaptFsInterface(fs);
  const shallows = await GitShallowManager.read({ fs, gitdir });
  const startingSet = new Set<string>();
  const finishingSet = new Set<string>();

  for (const ref of start) {
    startingSet.add(await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref }));
  }

  for (const ref of finish) {
    /*** We may not have these refs locally so we must try/catch ***/
    try {
      const oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });
      finishingSet.add(oid);
    } catch {
      /*** ignore errors for refs we don’t have locally ***/
    }
  }

  const visited = new Set<string>();
  /*** Because git commits are named by their hash, there is no
  way to construct a cycle. Therefore we won’t worry about
  setting a default recursion limit. ***/
  async function walk(oid: string): Promise<void> {
    visited.add(oid);
    const { object, type } = await readObject({ fs, cache, gitdir, oid });

    /*** Recursively resolve annotated tags ***/
    if (type === "tag") {
      const tag = GitAnnotatedTag.from(object);
      const commit = tag.headers().object;

      return walk(commit);
    }

    if (type !== "commit")
      throw new ObjectTypeError(oid, (type || "blob") as any, "commit");

    if (!shallows.has(oid)) {
      const commit = GitCommit.from(object);
      const parents = commit.headers().parent;

      for (const parentOid of parents) {
        if (!finishingSet.has(parentOid) && !visited.has(parentOid))
          await walk(parentOid);
      }
    }
  }

  /*** Let’s go walking! ***/
  for (const oid of startingSet) {
    await walk(oid);
  }

  return visited;
}

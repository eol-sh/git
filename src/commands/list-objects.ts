/**
 * @fileoverview Git list-objects command implementation
 *
 * Internal implementation of the list-objects Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/list-objects.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitTree } from "../models/git-tree.ts";
import { join } from "../utils/join.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { Cache, FsInterface } from "../types.ts";

interface ListObjectsOptions {
  cache: Cache;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  oids: Iterable<string>;
}



//// export

export async function listObjects({
  cache,
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  oids
}: ListObjectsOptions): Promise<Set<string>> {
  const visited = new Set<string>();
  /*** We don’t do the purest simplest recursion, because we can
  avoid reading Blob objects entirely since the Tree objects
  tell us which oids are Blobs and which are Trees. ***/
  async function walk(oid: string): Promise<void> {
    if (visited.has(oid))
      return;

    visited.add(oid);

    const { object, type } = await readObject({ cache, fs, gitdir, oid });

    if (type === "tag") {
      const tag = GitAnnotatedTag.from(object);
      const obj = tag.headers().object;

      await walk(obj);
    } else if (type === "commit") {
      const commit = GitCommit.from(object);
      const tree = commit.headers().tree;

      await walk(tree);
    } else if (type === "tree") {
      const tree = GitTree.from(object);

      for (const entry of tree) {
        /*** add blobs to the set
        skip over submodules whose type is "commit" ***/
        if (entry.type === "blob")
          visited.add(entry.oid);

        /*** recurse for trees ***/
        if (entry.type === "tree")
          await walk(entry.oid);
      }
    }
  }

  /*** Let’s go walking! ***/
  for (const oid of oids) {
    await walk(oid);
  }

  return visited;
}

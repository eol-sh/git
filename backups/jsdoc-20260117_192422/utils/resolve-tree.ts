


//// util

import { _readObject } from "../storage/read-object.ts";
import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitTree } from "../models/git-tree.ts";
import { ObjectTypeError } from "../errors/object-type.ts";

import type { FsInterface } from "../types.ts";

interface ResolveTreeOptions {
  cache: Map<string, any>;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}

interface ResolveTreeResult {
  oid: string;
  tree: GitTree;
}



//// export

export async function resolveTree({
  cache,
  fs,
  gitdir,
  oid
}: ResolveTreeOptions): Promise<ResolveTreeResult> {
  /*** Empty tree - bypass `readObject` ***/
  if (oid === "4b825dc642cb6eb9a060e54bf8d69288fbee4904")
    return { oid, tree: GitTree.from([]) };

  const { object, type } = await _readObject({ cache, fs, gitdir, oid });

  /*** Resolve annotated tag objects to whatever ***/
  if (type === "tag") {
    const newOid = GitAnnotatedTag.from(object).parse().object;
    return resolveTree({ cache, fs, gitdir, oid: newOid });
  }

  /*** Resolve commits to trees ***/
  if (type === "commit") {
    const newOid = GitCommit.from(object).parse().tree;
    return resolveTree({ cache, fs, gitdir, oid: newOid });
  }

  if (type !== "tree")
    throw new ObjectTypeError(oid, type as any, "tree");

  return { oid, tree: GitTree.from(object) };
}

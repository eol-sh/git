


//// util

import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { GitCommit } from "../models/git-commit.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { FsInterface } from "../types.ts";

interface ResolveCommitOptions {
  cache: Map<string, unknown>;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}

interface ResolveCommitResult {
  commit: GitCommit;
  oid: string;
}



//// export

export async function resolveCommit({
  cache,
  fs,
  gitdir,
  oid
}: ResolveCommitOptions): Promise<ResolveCommitResult> {
  const { object, type } = await readObject({ cache, fs, gitdir, oid });

  /*** Resolve annotated tag objects to whatever ***/
  if (type === "tag") {
    const newOid = GitAnnotatedTag.from(object).parse().object;
    return resolveCommit({ cache, fs, gitdir, oid: newOid });
  }

  if (type !== "commit")
    throw new ObjectTypeError(oid, type as any, "commit");

  return { commit: GitCommit.from(object), oid };
}

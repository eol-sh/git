


//// util

import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { FsInterface } from "../types.ts";

interface ResolveBlobOptions {
  cache: Map<string, any>;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}

interface ResolveBlobResult {
  blob: Uint8Array;
  oid: string;
}



//// export

export async function resolveBlob({
  cache,
  fs,
  gitdir,
  oid
}: ResolveBlobOptions): Promise<ResolveBlobResult> {
  const { object, type } = await readObject({ cache, fs, gitdir, oid });

  /*** Resolve annotated tag objects to whatever ***/
  if (type === "tag") {
    const newOid = GitAnnotatedTag.from(object).parse().object;
    return resolveBlob({ cache, fs, gitdir, oid: newOid });
  }

  if (type !== "blob")
    throw new ObjectTypeError(oid, type as any, "blob");

  return { blob: new Uint8Array(object), oid };
}

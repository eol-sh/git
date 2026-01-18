


//// util

import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { Cache, FsInterface, ReadTagResult } from "../types.ts";

interface ReadTagOptions {
  cache: Cache;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function _readTag({ cache, fs, gitdir, oid }: ReadTagOptions): Promise<ReadTagResult> {
  const { object, type } = await readObject({
    cache,
    format: "content",
    fs,
    gitdir,
    oid
  });

  if (type !== "tag")
    throw new ObjectTypeError(oid, type as any, "tag");

  const tag = GitAnnotatedTag.from(object);

  const result = {
    oid,
    payload: tag.payload(),
    tag: tag.parse()
  };

  return result;
}

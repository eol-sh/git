


//// util

import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { _writeObject as writeObject } from "../storage/write-object.ts";

import type { FsInterface, TagObject } from "../types.ts";

interface WriteTagOptions {
  fs: FsInterface;
  gitdir: string;
  tag: TagObject;
}



//// export

export async function _writeTag({ fs, gitdir, tag }: WriteTagOptions): Promise<string> {
  /*** Convert object to buffer ***/
  const object = GitAnnotatedTag.from(tag).toObject();

  const oid = await writeObject({
    format: "content",
    fs,
    gitdir,
    object,
    type: "tag"
  });

  return oid;
}

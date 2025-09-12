


//// util

import { _readObject as readObject } from "../storage/read-object.ts";
import type { Cache, FsInterface, ReadObjectResult } from "../types.ts";

interface ReadObjectOptions {
  cache: Cache;
  filepath?: string;
  format?: "content" | "deflated" | "parsed" | "wrapped";
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function _readObject({
  cache,
  filepath,
  format = "parsed",
  fs,
  gitdir,
  oid
}: ReadObjectOptions): Promise<ReadObjectResult> {
  const result = await readObject({
    cache,
    filepath,
    format,
    fs,
    gitdir,
    oid
  });

  return result;
}

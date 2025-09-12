


//// util

import { resolveBlob } from "../utils/resolve-blob.ts";
import { resolveFilepath } from "../utils/resolve-filepath.ts";

import type { Cache, FsInterface, ReadBlobResult } from "../types.ts";

interface ReadBlobOptions {
  cache: Cache;
  filepath?: string;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function _readBlob({
  cache,
  filepath = undefined,
  fs,
  gitdir,
  oid
}: ReadBlobOptions): Promise<ReadBlobResult> {
  if (filepath !== undefined)
    oid = await resolveFilepath({ cache, filepath, fs, gitdir, oid });

  const blob = await resolveBlob({
    cache,
    fs,
    gitdir,
    oid
  });

  return blob;
}

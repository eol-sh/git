/**
 * @fileoverview Git read-blob command implementation
 *
 * Internal implementation of the read-blob Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/read-blob.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


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

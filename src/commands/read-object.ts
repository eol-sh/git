/**
 * @fileoverview Git read-object command implementation
 *
 * Internal implementation of the read-object Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/read-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


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

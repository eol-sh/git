/**
 * @fileoverview Git write-blob command implementation
 *
 * Internal implementation of the write-blob Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/write-blob.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { _writeObject as writeObject } from "../storage/write-object.ts";
import type { FsInterface } from "../types.ts";

interface WriteBlobOptions {
  blob: Uint8Array;
  fs: FsInterface;
  gitdir: string;
}



//// export

export async function _writeBlob({ blob, fs, gitdir }: WriteBlobOptions): Promise<string> {
  const oid = await writeObject({
    format: "content",
    fs,
    gitdir,
    object: blob,
    type: "blob"
  });

  return oid;
}

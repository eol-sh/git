/**
 * @fileoverview Git hash-blob API - High-level user interface
 *
 * This module provides the public API for hash-blob operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/hash-blob.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { assertParameter } from "../utils/assert-parameter.ts";
import { hashObject } from "../storage/hash-object.ts";

interface HashBlobResult {
  format: "wrapped";
  object: Uint8Array;
  oid: string;
  type: "blob";
}



//// export

/**
 * Compute what the SHA-1 object id of a file would be
 */
export async function hashBlob({ object }: { object: Uint8Array | string; }): Promise<HashBlobResult> {
  try {
    assertParameter("object", object);

    /*** Convert object to buffer ***/
    let objectBuffer: Uint8Array;

    if (typeof object === "string")
      objectBuffer = new TextEncoder().encode(object);
    else if (!(object instanceof Uint8Array))
      objectBuffer = new Uint8Array(object);
    else
      objectBuffer = object;

    const type = "blob";

    const { object: _object, oid } = await hashObject({
      format: "content",
      object: objectBuffer,
      type
    });

    return { format: "wrapped", object: _object, oid, type };
  } catch(err: unknown) {
    (err as any).caller = "git.hashBlob";
    throw err;
  }
}

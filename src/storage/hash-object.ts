/**
 * @fileoverview hash-object storage operations
 *
 * Low-level storage operations for hash-object including reading,
 * writing, and managing Git objects on the file system.
 *
 * @module storage/hash-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { GitObject } from "../models/git-object.ts";
import { shasum } from "../utils/shasum.ts";

interface HashObjectOptions {
  format?: "content" | "wrapped" | "deflated";
  object: Uint8Array;
  oid?: string;
  type: string;
}

interface HashObjectResult {
  object: Uint8Array;
  oid: string;
}



//// export

export async function hashObject({
  format = "content",
  object,
  oid = undefined,
  type
}: HashObjectOptions): Promise<HashObjectResult> {
  let resultOid = oid;
  let resultObject = object;

  if (format !== "deflated") {
    if (format !== "wrapped")
      resultObject = GitObject.wrap({ object, type });

    resultOid = await shasum(resultObject);
  }

  return { object: resultObject, oid: resultOid! };
}

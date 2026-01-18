/**
 * @fileoverview write-object storage operations
 *
 * Low-level storage operations for write-object including reading,
 * writing, and managing Git objects on the file system.
 *
 * @module storage/write-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { deflate } from "../utils/deflate.ts";
import { GitObject } from "../models/git-object.ts";
import { shasum } from "../utils/shasum.ts";
import { writeObjectLoose } from "../storage/write-object-loose.ts";

import type { FsInterface } from "../types.ts";

interface WriteObjectOptions {
  dryRun?: boolean;
  format?: "content" | "deflated" | "wrapped";
  fs: FsInterface;
  gitdir: string;
  object: Uint8Array;
  oid?: string;
  type: string;
}



//// export

export async function _writeObject({
  dryRun = false,
  format = "content",
  fs,
  gitdir,
  object,
  oid = undefined,
  type
}: WriteObjectOptions): Promise<string> {
  let finalObject = object;
  let computedOid = oid;

  if (format !== "deflated") {
    if (format !== "wrapped")
      finalObject = GitObject.wrap({ object, type });

    computedOid = await shasum(finalObject);
    finalObject = new Uint8Array(await deflate(finalObject));
  }

  if (!dryRun) {
    await writeObjectLoose({
      format: "deflated",
      fs,
      gitdir,
      object: finalObject,
      oid: computedOid!
    });
  }

  return computedOid!;
}

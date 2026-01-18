/**
 * @fileoverview has-object storage operations
 *
 * Low-level storage operations for has-object including reading,
 * writing, and managing Git objects on the file system.
 *
 * @module storage/has-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { hasObjectLoose } from "../storage/has-object-loose.ts";
import { hasObjectPacked } from "../storage/has-object-packed.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { Cache, FsInterface } from "../types.ts";

interface HasObjectOptions {
  cache: Cache;
  format?: string;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function hasObject({
  cache,
  fs,
  gitdir,
  oid
}: HasObjectOptions): Promise<boolean> {
  /*** Curry the current read method so that the packfile un-deltification
  process can acquire external ref-deltas. ***/
  const getExternalRefDelta = (oid: string) => readObject({ cache, fs, gitdir, oid });

  /*** Look for it in the loose object directory. ***/
  let result = await hasObjectLoose({ fs, gitdir, oid });

  /*** Check to see if it’s in a packfile. ***/
  if (!result) {
    result = await hasObjectPacked({
      cache,
      fs,
      getExternalRefDelta,
      gitdir,
      oid
    });
  }

  /*** Finally ***/
  return result;
}

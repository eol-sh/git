/**
 * @fileoverview has-object-packed storage operations
 *
 * Low-level storage operations for has-object-packed including reading,
 * writing, and managing Git objects on the file system.
 *
 * @module storage/has-object-packed.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { InternalError } from "../errors/internal.ts";
import { join } from "../utils/join.ts";
import { readPackIndex } from "../storage/read-pack-index.ts";

import type { FsInterface } from "../types.ts";

interface HasObjectPackedOptions {
  cache: Map<string, any>;
  fs: FsInterface;
  getExternalRefDelta?: (oid: string) => Promise<{ type?: string; object: Uint8Array } | undefined>;
  gitdir: string;
  oid: string;
}



//// export

export async function hasObjectPacked({
  cache,
  fs,
  getExternalRefDelta,
  gitdir,
  oid
}: HasObjectPackedOptions): Promise<boolean> {
  /*** Check to see if it’s in a packfile.
  Iterate through all the .idx files ***/
  const list = await fs.readdir(join(gitdir, "objects/pack"));

  /*** Handle both Deno and Node.js readdir return types ***/
  const fileList = Array.isArray(list) ?
    list :
    await (async () => {
      const result: string[] = [];

      for await (const entry of list as AsyncIterable<{ name: string }>) {
        result.push(entry.name);
      }

      return result;
    })();

  const indexFiles = fileList.filter((x) => x.endsWith(".idx"));

  for (const filename of indexFiles) {
    const indexFile = `${gitdir}/objects/pack/${filename}`;

    const p = await readPackIndex({
      cache,
      filename: indexFile,
      fs,
      ...(getExternalRefDelta ? { getExternalRefDelta } : {})
    });

    if ((p as any).error)
      throw new InternalError((p as any).error);

    /*** If the packfile DOES have the oid we’re looking for... ***/
    if (p.offsets.has(oid))
      return true;
  }

  /*** Failed to find it ***/
  return false;
}

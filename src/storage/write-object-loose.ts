/**
 * @fileoverview write-object-loose storage operations
 *
 * Low-level storage operations for write-object-loose including reading,
 * writing, and managing Git objects on the file system.
 *
 * @module storage/write-object-loose.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { dirname } from "../utils/dirname.ts";
import { InternalError } from "../errors/internal.ts";

import type { FsInterface } from "../types.ts";

interface WriteObjectLooseOptions {
  format: "deflated";
  fs: FsInterface;
  gitdir: string;
  object: Uint8Array;
  oid: string;
}



//// export

export async function writeObjectLoose({
  format,
  fs,
  gitdir,
  object,
  oid
}: WriteObjectLooseOptions): Promise<void> {
  if (format !== "deflated")
    throw new InternalError("GitObjectStoreLoose expects objects to write to be in deflated format",);

  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;
  const filepath = `${gitdir}/${source}`;

  /*** Don’t overwrite existing git objects - this helps avoid EPERM errors.
  Although I don’t know how we’d fix corrupted objects then. Perhaps delete them on read? ***/

  try {
    /*** Try to stat the file to check if it exists ***/
    await fs.stat(filepath);
    /*** If we get here, file exists, so don’t write ***/
    return;
  } catch {
    /*** File doesn’t exist, so we can write it
    First ensure the directory exists ***/
    const dir = dirname(filepath);

    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      /*** Directory might already exist, that’s ok ***/
    }

    await fs.writeFile(filepath, object);
  }
}

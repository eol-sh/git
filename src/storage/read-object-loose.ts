/**
 * @fileoverview read-object-loose storage operations
 *
 * Low-level storage operations for read-object-loose including reading,
 * writing, and managing Git objects on the file system.
 *
 * @module storage/read-object-loose.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import type { FsInterface } from "../types.ts";

interface ReadObjectLooseOptions {
  fs: FsInterface;
  gitdir: string;
  oid: string;
}

interface ReadObjectLooseResult {
  format: "deflated";
  object: Uint8Array;
  source: string;
}



//// export

export async function readObjectLoose({ fs, gitdir, oid }: ReadObjectLooseOptions): Promise<ReadObjectLooseResult | null> {
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;

  try {
    const file = await fs.readFile(`${gitdir}/${source}`);

    if (!file)
      return null;

    return {
      format: "deflated",
      object: file,
      source
    };
  } catch {
    /*** File doesn’t exist ***/
    return null;
  }
}

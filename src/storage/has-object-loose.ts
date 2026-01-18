/**
 * @fileoverview has-object-loose storage operations
 *
 * Low-level storage operations for has-object-loose including reading,
 * writing, and managing Git objects on the file system.
 *
 * @module storage/has-object-loose.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import type { FsInterface } from "../types.ts";

interface HasObjectLooseOptions {
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function hasObjectLoose({ fs, gitdir, oid }: HasObjectLooseOptions): Promise<boolean> {
  const source = `objects/${oid.slice(0, 2)}/${oid.slice(2)}`;

  try {
    await fs.stat(`${gitdir}/${source}`);
    return true;
  } catch {
    return false;
  }
}

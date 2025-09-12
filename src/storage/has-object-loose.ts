


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

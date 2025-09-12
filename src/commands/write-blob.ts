


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

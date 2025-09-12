


//// util

import { _readBlob } from "./read-blob.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitRefManager } from "../managers/git-ref.ts";

import type { Cache, FsInterface } from "../types.ts";

interface ReadNoteOptions {
  cache: Cache;
  fs: FsInterface;
  gitdir: string;
  oid: string;
  ref?: string;
}



//// export

export async function _readNote({
  cache,
  fs,
  gitdir,
  oid,
  ref = "refs/notes/commits"
}: ReadNoteOptions): Promise<Uint8Array> {
  const unifiedFs = adaptFsInterface(fs);
  const parent = await GitRefManager.resolve({ gitdir, fs: unifiedFs, ref });

  const { blob } = await _readBlob({
    cache,
    filepath: oid,
    fs,
    gitdir,
    oid: parent
  });

  return blob;
}




//// util

import { GitPackIndex } from "../models/git-pack-index.ts";
import { join } from "../utils/join.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { Cache, FsInterface, ProgressCallback } from "../types.ts";

interface IndexPackOptions {
  cache: Cache;
  dir: string;
  filepath: string;
  fs: FsInterface;
  gitdir: string;
  onProgress?: ProgressCallback;
}

interface IndexPackResult {
  oids: string[];
}



//// export

export async function _indexPack({
  cache,
  dir,
  filepath,
  fs,
  gitdir,
  onProgress
}: IndexPackOptions): Promise<IndexPackResult> {
  try {
    filepath = join(dir, filepath);
    const pack = await fs.readFile(filepath);

    const getExternalRefDelta = async(oid: string) => {
      const result = await readObject({ cache, fs, gitdir, oid });
      return { ...result, type: result.type as any };
    };

    const idx = await GitPackIndex.fromPack({
      getExternalRefDelta,
      ...(onProgress ? { onProgress: onProgress as any } : {}),
      pack
    });

    await fs.writeFile(filepath.replace(/\.pack$/, ".idx"), await idx.toBuffer());

    return {
      oids: [...idx.hashes]
    };
  } catch(err: unknown) {
    (err as any).caller = "git.indexPack";
    throw err;
  }
}

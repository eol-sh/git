


//// util

import { GitPackIndex } from "../models/git-pack-index.ts";
import type { FsInterface } from "../types.ts";

const PackfileCache = Symbol("PackfileCache");

interface LoadPackIndexOptions {
  emitter?: any;
  emitterPrefix?: string;
  filename: string;
  fs: FsInterface;
  getExternalRefDelta?: (oid: string) => Promise<{ type?: string; object: Uint8Array } | undefined>;
}

interface ReadPackIndexOptions {
  cache: Map<string, any>;
  emitter?: any;
  emitterPrefix?: string;
  filename: string;
  fs: FsInterface;
  getExternalRefDelta?: (oid: string) => Promise<{ type?: string; object: Uint8Array } | undefined>;
}



//// export

export function readPackIndex({
  cache,
  emitter,
  emitterPrefix,
  filename,
  fs,
  getExternalRefDelta
}: ReadPackIndexOptions): Promise<GitPackIndex> {
  /*** Try to get the packfile index from the in-memory cache ***/
  if (!(cache as any)[PackfileCache])
    (cache as any)[PackfileCache] = new Map();

  let p = (cache as any)[PackfileCache].get(filename);

  if (!p) {
    p = loadPackIndex({
      emitter,
      ...(emitterPrefix !== undefined ? { emitterPrefix } : {}),
      filename,
      fs,
      ...(getExternalRefDelta !== undefined ? { getExternalRefDelta } : {})
    });

    (cache as any)[PackfileCache].set(filename, p);
  }

  return p;
}



//// helper

async function loadPackIndex({
  filename,
  fs,
  getExternalRefDelta
}: Omit<LoadPackIndexOptions, "_emitter" | "_emitterPrefix">): Promise<GitPackIndex> {
  const idx = await fs.readFile(filename);

  const result = await GitPackIndex.fromIdx({
    getExternalRefDelta: getExternalRefDelta as any,
    idx
  });

  if (!result)
    throw new Error(`Unable to parse pack index file: ${filename}`);

  return result;
}

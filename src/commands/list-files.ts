


//// util

import { _readTree } from "../commands/read-tree.ts";
import { _walk } from "../commands/walk.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";
import { TREE } from "../commands/tree.ts";

import type { Cache, FsInterface } from "../types.ts";

interface AccumulateFilesOptions {
  cache: Cache;
  filenames: string[];
  fs: FsInterface;
  gitdir: string;
  oid: string;
  prefix: string;
}

interface ListFilesOptions {
  cache: Cache;
  fs: FsInterface;
  gitdir: string;
  ref?: string;
}



//// export

export async function _listFiles({ cache, fs, gitdir, ref }: ListFilesOptions): Promise<string[]> {
  const unifiedFs = adaptFsInterface(fs);

  if (ref) {
    const oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });
    const filenames: string[] = [];

    await accumulateFilesFromOid({
      cache,
      filenames,
      fs,
      gitdir,
      oid,
      prefix: ""
    });
    return filenames;
  } else {
    const unifiedFs = adaptFsInterface(fs);

    return GitIndexManager.acquire({ cache, fs: unifiedFs, gitdir }, (index) => {
      return index.entries.map((x) => x.path);
    });
  }
}



//// helper

async function accumulateFilesFromOid({
  cache,
  filenames,
  fs,
  gitdir,
  oid,
  prefix
}: AccumulateFilesOptions): Promise<void> {
  /*** Use the walk API for better performance ***/
  const results = await _walk({
    cache,
    dir: "", /*** Not used for tree walking ***/
    fs,
    gitdir,
    map: async(filepath: string, entries: unknown[]) => {
      if (filepath === ".")
        return; /*** Skip root ***/

      const [entry] = entries;

      if (entry && await (entry as any).type() === "blob")
        return join(prefix, filepath);

      return undefined;
    },
    trees: [TREE({ ref: oid })]
  });

  /*** Filter out undefined results and add to filenames ***/
  if (Array.isArray(results))
    filenames.push(...results.filter(Boolean) as string[]);
}

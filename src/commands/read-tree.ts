


//// util

import { resolveFilepath } from "../utils/resolve-filepath.ts";
import { resolveTree } from "../utils/resolve-tree.ts";

import type { FsInterface, TreeEntry } from "../types.ts";

interface ReadTreeOptions {
  cache: Map<string, any>;
  filepath?: string;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}

interface ReadTreeResult {
  oid: string;
  tree: TreeEntry[];
}



//// export

export async function _readTree({
  cache,
  filepath = undefined,
  fs,
  gitdir,
  oid
}: ReadTreeOptions): Promise<ReadTreeResult> {
  let resultOid = oid;

  if (filepath !== undefined)
    resultOid = await resolveFilepath({ cache, filepath, fs, gitdir, oid });

  const { oid: treeOid, tree } = await resolveTree({
    cache,
    fs,
    gitdir,
    oid: resultOid
  });

  const result = {
    oid: treeOid,
    tree: tree.entries()
  };

  return result;
}

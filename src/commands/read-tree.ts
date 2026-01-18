


/**
 * @fileoverview Command for reading Git tree objects and their contents
 * 
 * This module provides functionality to read and parse Git tree objects, which
 * represent directory structures in the repository. The command can read entire
 * trees or specific file paths within trees, resolving object references to
 * retrieve the actual tree structure. It handles both direct tree object access
 * and path-based resolution within tree hierarchies, supporting operations that
 * need to inspect repository structure at specific commits.
 * 
 * @module commands/read-tree
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { resolveFilepath } from "../utils/resolve-filepath.ts";
import { resolveTree } from "../utils/resolve-tree.ts";

import type { FsInterface, TreeEntry } from "../types.ts";

interface ReadTreeOptions {
  cache?: Map<string, any>;
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
    resultOid = await resolveFilepath({ cache: cache!, filepath, fs, gitdir, oid });

  const { oid: treeOid, tree } = await resolveTree({
    cache: cache!,
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

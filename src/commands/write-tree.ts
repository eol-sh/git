


//// util

import { GitTree } from "../models/git-tree.ts";
import { _writeObject as writeObject } from "../storage/write-object.ts";

import type { FsInterface, TreeObject } from "../types.ts";

interface WriteTreeOptions {
  fs: FsInterface;
  gitdir: string;
  tree: TreeObject;
}



//// export

export async function _writeTree({ fs, gitdir, tree }: WriteTreeOptions): Promise<string> {
  /*** Convert object to buffer ***/
  const object = GitTree.from(tree).toObject();

  const oid = await writeObject({
    format: "content",
    fs,
    gitdir,
    object,
    type: "tree"
  });

  return oid;
}

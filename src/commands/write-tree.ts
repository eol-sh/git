


/**
 * @fileoverview Command for writing Git tree objects to object storage
 * 
 * This module provides functionality to write Git tree objects to the repository's
 * object database. The command takes tree structure data including file paths,
 * modes, and object IDs, formats it according to Git's tree object format, and
 * stores it in the object database with proper SHA-1 hashing. This is a low-level
 * operation used by commit creation and other tree manipulation commands to
 * persist directory structure data to repository storage.
 * 
 * @module commands/write-tree
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

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

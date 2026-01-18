/**
 * @fileoverview Git remove-note command implementation
 *
 * Internal implementation of the remove-note Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/remove-note.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { _commit } from "./commit.ts";
import { _readTree } from "./read-tree.ts";
import { _writeTree } from "./write-tree.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { NotFoundError } from "../errors/not-found.ts";

import type { Author, Cache, FsInterface, SignCallback } from "../types.ts";

interface RemoveNoteOptions {
  author: Author;
  cache: Cache;
  committer: Author;
  fs: FsInterface;
  gitdir: string;
  oid: string;
  onSign?: SignCallback;
  ref?: string;
  signingKey?: string;
}



//// export

export async function _removeNote({
  author,
  cache,
  committer,
  fs,
  gitdir,
  oid,
  onSign,
  ref = "refs/notes/commits",
  signingKey
}: RemoveNoteOptions): Promise<string> {
  const unifiedFs = adaptFsInterface(fs);

  /*** Get the current note commit ***/
  let parent: string | undefined;

  try {
    parent = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });
  } catch(err) {
    if (!(err instanceof NotFoundError))
      throw err;
  }

  /*** I’m using the "empty tree" magic number here for brevity ***/
  const result = await _readTree({
    cache,
    fs,
    gitdir,
    oid: parent || "4b825dc642cb6eb9a060e54bf8d69288fbee4904"
  });

  let tree = result.tree;

  /*** Remove the note blob entry from the tree ***/
  tree = tree.filter((entry) => entry.path !== oid);

  /*** Create the new note tree ***/
  const treeOid = await _writeTree({
    fs,
    gitdir,
    tree
  });

  /*** Create the new note commit ***/
  const commitOid = await _commit({
    author,
    cache,
    committer,
    fs,
    gitdir,
    message: `Note removed by "@eol/git removeNote"\n`,
    ...(onSign !== undefined ? { onSign } : {}),
    ...(parent ? { parent: [parent] } : {}),
    ref,
    ...(signingKey !== undefined ? { signingKey } : {}),
    tree: treeOid
  });

  return commitOid;
}

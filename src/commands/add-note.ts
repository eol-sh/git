


//// util

import { _commit } from "../commands/commit.ts";
import { _readTree } from "../commands/read-tree.ts";
import { _writeTree } from "../commands/write-tree.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { AlreadyExistsError } from "../errors/already-exists.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { _writeObject as writeObject } from "../storage/write-object.ts";

import type { Author, Cache, Committer, FsInterface, OnSignCallback } from "../types.ts";

interface AddNoteOptions {
  author: Author;
  cache: Cache;
  committer: Committer;
  force?: boolean;
  fs: FsInterface;
  gitdir: string;
  note: string | Uint8Array;
  oid: string;
  onSign?: OnSignCallback;
  ref: string;
  signingKey?: string;
}



//// export

export async function _addNote({
  author,
  cache,
  committer,
  force,
  fs,
  gitdir,
  note,
  oid,
  onSign,
  ref,
  signingKey
}: AddNoteOptions): Promise<string> {
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

  /*** Handle the case where a note already exists ***/
  if (force) {
    tree = tree.filter((entry) => entry.path !== oid);
  } else {
    for (const entry of tree) {
      if (entry.path === oid)
        throw new AlreadyExistsError("note", oid);
    }
  }

  /*** Create the note blob ***/
  let noteData: Uint8Array;

  if (typeof note === "string")
    noteData = new TextEncoder().encode(note);
  else
    noteData = note;

  const noteOid = await writeObject({
    format: "content",
    fs,
    gitdir,
    object: noteData,
    type: "blob"
  });

  /*** Create the new note tree ***/
  tree.push({
    mode: "100644",
    oid: noteOid,
    path: oid,
    type: "blob"
  });

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
    message: `Note added by "@eol/git addNote"\n`,
    ...(onSign ? { onSign } : {}),
    ...(parent ? { parent: [parent] } : {}),
    ref,
    ...(signingKey ? { signingKey } : {}),
    tree: treeOid
  });

  return commitOid;
}

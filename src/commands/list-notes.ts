


/**
 * @fileoverview Command for listing Git notes attached to objects
 * 
 * This module provides functionality to list all Git notes from a specified
 * notes reference. Git notes are metadata attachments to Git objects that don't
 * modify the objects themselves. The command reads the notes tree structure and
 * returns a mapping of target objects to their associated note objects, enabling
 * inspection of all notes in a notes namespace without modifying the underlying
 * repository structure.
 * 
 * @module commands/list-notes
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { _readTree } from "./read-tree.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { NotFoundError } from "../errors/not-found.ts";

import type { Cache, FsInterface } from "../types.ts";

interface ListNotesOptions {
  cache: Cache;
  fs: FsInterface;
  gitdir: string;
  ref: string;
}

interface NoteEntry {
  note: string;
  target: string;
}



//// export

/**
 * List all the object notes
 */
export async function _listNotes({ cache, fs, gitdir, ref }: ListNotesOptions): Promise<NoteEntry[]> {
  const unifiedFs = adaptFsInterface(fs);

  /*** Get the current note commit ***/
  let parent: string;

  try {
    parent = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });
  } catch(err) {
    if (err instanceof NotFoundError)
      return [];

    throw err;
  }

  /*** Create the current note tree ***/
  const result = await _readTree({
    cache,
    fs,
    gitdir,
    oid: parent
  });

  /*** Format the tree entries ***/
  const notes: NoteEntry[] = result.tree.map((entry) => ({
    note: entry.oid,
    target: entry.path
  }));

  return notes;
}

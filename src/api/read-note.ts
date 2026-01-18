/**
 * @fileoverview Git read-note API - High-level user interface
 *
 * This module provides the public API for read-note operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/read-note.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _readNote } from "../commands/read-note.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsInterface } from "../types.ts";



//// export

export interface ReadNoteOptions {
  cache?: Cache;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  oid: string;
  ref?: string;
}

/**
 * Read the contents of a note
 *
 * @param args - The options for readNote
 * @param args.fs - a file system client
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.ref - The notes ref to look under
 * @param args.oid - The SHA-1 object id of the object to get the note for.
 * @param args.cache - a [cache](cache.md) object
 *
 * @returns Resolves successfully with note contents as a Buffer.
 */
export async function readNote({
  cache = new Map(),
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  oid,
  ref = "refs/notes/commits"
}: ReadNoteOptions): Promise<Uint8Array> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);
    assertParameter("oid", oid);

    return await _readNote({
      cache,
      fs: adaptFileSystem(new FileSystem(fs)),
      gitdir,
      oid,
      ref
    });
  } catch(err: unknown) {
    (err as any).caller = "git.readNote";
    throw err;
  }
}

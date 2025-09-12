


//// util

import { _addNote } from "../commands/add-note.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";
import { MissingNameError } from "../errors/missing-name.ts";
import { normalizeAuthorObject } from "../utils/normalize-author-object.ts";
import { normalizeCommitterObject } from "../utils/normalize-committer-object.ts";

import type { Author, Cache, Committer, FsClient, SignCallback } from "../types.ts";

interface AddNoteOptions {
  author?: Partial<Author>;
  cache?: Cache;
  committer?: Partial<Committer>;
  dir?: string;
  force?: boolean;
  fs: FsClient;
  gitdir?: string;
  note: string | Uint8Array;
  oid: string;
  onSign?: SignCallback;
  ref?: string;
  signingKey?: string;
}



//// export

/**
 * Add or update an object note
 */
export async function addNote({
  author: _author,
  cache = new Map(),
  committer: _committer,
  dir,
  force,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  note,
  oid,
  onSign,
  ref = "refs/notes/commits",
  signingKey
}: AddNoteOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    assertParameter("note", note);

    if (signingKey)
      assertParameter("onSign", onSign);

    const fs = adaptFileSystem(new FileSystem(_fs));

    const author = await normalizeAuthorObject({
      author: _author || {},
      fs,
      gitdir
    });

    if (!author)
      throw new MissingNameError("author");

    const committer = await normalizeCommitterObject({
      author,
      committer: _committer || {},
      fs,
      gitdir
    });

    if (!committer)
      throw new MissingNameError("committer");

    const options: any = {
      author,
      cache,
      committer,
      fs,
      gitdir,
      note,
      oid,
      ref
    };

    if (force !== undefined)
      options.force = force;

    if (onSign !== undefined)
      options.onSign = onSign;

    if (signingKey !== undefined)
      options.signingKey = signingKey;

    return await _addNote(options);
  } catch(err: unknown) {
    (err as any).caller = "git.addNote";
    throw err;
  }
}

/**
 * @fileoverview Git remove-note API - High-level user interface
 *
 * This module provides the public API for remove-note operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/remove-note.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _removeNote } from "../commands/remove-note.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";
import { MissingNameError } from "../errors/missing-name.ts";
import { normalizeAuthorObject } from "../utils/normalize-author-object.ts";
import { normalizeCommitterObject } from "../utils/normalize-committer-object.ts";

import type { Author, Cache, Committer, FsInterface, SignCallback } from "../types.ts";



//// export

export interface RemoveNoteOptions {
  author?: Author;
  cache?: Cache;
  committer?: Committer;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  oid: string;
  onSign?: SignCallback;
  ref?: string;
  signingKey?: string;
}

/**
 * Remove an object note
 *
 * @param args - The options for removeNote
 * @param args.fs - a file system client
 * @param args.onSign - a PGP signing implementation
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.ref - The notes ref to look under
 * @param args.oid - The SHA-1 object id of the object to remove the note from.
 * @param args.author - The details about the author.
 * @param args.author.name - Default is `user.name` config.
 * @param args.author.email - Default is `user.email` config.
 * @param args.author.timestamp - Set the author timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param args.author.timezoneOffset - Set the author timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param args.committer - The details about the note committer, in the same format as the author parameter. If not specified, the author details are used.
 * @param args.committer.name - Default is `user.name` config.
 * @param args.committer.email - Default is `user.email` config.
 * @param args.committer.timestamp - Set the committer timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param args.committer.timezoneOffset - Set the committer timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param args.signingKey - Sign the tag object using this private PGP key.
 * @param args.cache - a [cache](cache.md) object
 *
 * @returns Resolves successfully with the SHA-1 object id of the commit object for the note removal.
 */
export async function removeNote({
  author: _author,
  cache = new Map(),
  committer: _committer,
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  oid,
  onSign,
  ref = "refs/notes/commits",
  signingKey
}: RemoveNoteOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    const unifiedFs = adaptFsInterface(_fs);

    const author = await normalizeAuthorObject({
      ...(_author ? { author: _author } : {}),
      fs: _fs,
      gitdir
    });

    if (!author)
      throw new MissingNameError("author");

    const committer = await normalizeCommitterObject({
      author,
      ...(_committer ? { committer: _committer } : {}),
      fs: _fs,
      gitdir
    });

    if (!committer)
      throw new MissingNameError("committer");

    return await _removeNote({
      author,
      cache,
      committer,
      fs: unifiedFs,
      gitdir,
      oid,
      ...(onSign !== undefined ? { onSign } : {}),
      ref,
      ...(signingKey !== undefined ? { signingKey } : {})
    });
  } catch(err: unknown) {
    (err as any).caller = "git.removeNote";
    throw err;
  }
}

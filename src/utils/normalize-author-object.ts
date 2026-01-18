/**
 * @fileoverview normalize-author-object utility functions
 *
 * Utility functions for normalize-author-object operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/normalize-author-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { _getConfig } from "../commands/get-config.ts";
import { assignDefined } from "./assign-defined.ts";

import type { Author, CommitObject, FsInterface } from "../types.ts";

interface NormalizeAuthorOptions {
  fs: FsInterface;
  gitdir?: string;
  author?: Partial<Author>;
  commit?: CommitObject;
}



//// export

/**
 * Return author object by using properties following this priority:
 * (1) provided author object
 * -> (2) author of provided commit object
 * -> (3) Config and current date/time
 */
export async function normalizeAuthorObject({ author, commit, fs, gitdir }: NormalizeAuthorOptions): Promise<Author | undefined> {
  const timestamp = Math.floor(Date.now() / 1000);

  const defaultAuthor: Author = {
    email: (await _getConfig({ fs, gitdir: gitdir!, path: "user.email" })) ?? "", /*** author.email is allowed to be empty string ***/
    name: (await _getConfig({ fs, gitdir: gitdir!, path: "user.name" })) ?? "",
    timestamp,
    timezoneOffset: new Date(timestamp * 1000).getTimezoneOffset(),
  };

  // Populate author object by using properties with this priority:
  // (1) provided author object
  // -> (2) author of provided commit object
  // -> (3) default author
  const normalizedAuthor = assignDefined(
    {} as Partial<Author>,
    defaultAuthor,
    commit ?
      commit.author :
      {} as any,
    author || {} as any
  );

  if (normalizedAuthor.name === undefined || normalizedAuthor.name === "")
    return undefined;

  return normalizedAuthor as Author;
}

/**
 * @fileoverview normalize-committer-object utility functions
 *
 * Utility functions for normalize-committer-object operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/normalize-committer-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _getConfig } from "../commands/get-config.ts";
import { assignDefined } from "./assign-defined.ts";

import type { Author, CommitObject, Committer, FsInterface } from "../types.ts";

interface NormalizeCommitterOptions {
  author?: Partial<Author>;
  commit?: CommitObject;
  committer?: Partial<Committer>;
  fs: FsInterface;
  gitdir?: string;
}



//// export

/**
 * Return committer object by using properties with this priority:
 * (1) provided committer object
 * -> (2) provided author object
 * -> (3) committer of provided commit object
 * -> (4) Config and current date/time
 */
export async function normalizeCommitterObject({
  author,
  commit,
  committer,
  fs,
  gitdir
}: NormalizeCommitterOptions): Promise<Committer | undefined> {
  const timestamp = Math.floor(Date.now() / 1000);

  const defaultCommitter: Committer = {
    email: (await _getConfig({ fs, gitdir: gitdir!, path: "user.email" })) ?? "", /*** committer.email is allowed to be empty string ***/
    name: (await _getConfig({ fs, gitdir: gitdir!, path: "user.name" })) ?? "",
    timestamp,
    timezoneOffset: new Date(timestamp * 1000).getTimezoneOffset(),
  };

  const normalizedCommitter = assignDefined(
    {} as Partial<Committer>,
    defaultCommitter,
    commit ? commit.committer : {} as any,
    author || {} as any,
    committer || {} as any
  );

  if (normalizedCommitter.name === undefined || normalizedCommitter.name === "")
    return undefined;

  return normalizedCommitter as Committer;
}

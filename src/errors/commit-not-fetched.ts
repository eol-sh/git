/**
 * @fileoverview Error thrown when attempting to checkout a commit that hasn't been fetched
 * 
 * This error occurs when trying to checkout a branch or ref that references
 * a commit that doesn't exist in the local repository yet. Usually resolved
 * by running git fetch.
 * 
 * @module errors/commit-not-fetched
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";



//// export

export class CommitNotFetchedError extends BaseError {
  static readonly code = "CommitNotFetchedError" as const;

  constructor(ref: string, oid: string) {
    super(`Failed to checkout "${ref}" because commit ${oid} is not available locally. Do a git fetch to make the branch available locally.`);

    this.code = this.name = CommitNotFetchedError.code;
    this.data = { oid, ref };
  }
}

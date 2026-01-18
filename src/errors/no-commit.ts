


/**
 * @fileoverview No commit error implementation
 * 
 * This error is thrown when a reference (branch, tag, etc.) does not point
 * to any commit object. This commonly occurs when working with a repository
 * that has no commits yet, or when referencing a branch that exists but
 * has no commit history.
 * 
 * @module errors/no-commit
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class NoCommitError extends BaseError {
  static code = "NoCommitError" as const;
  public override code = NoCommitError.code;
  public override data: { ref: string };
  public override name = NoCommitError.code;

  constructor(ref: string) {
    super(`"${ref}" does not point to any commit. You’re maybe working on a repository with no commits yet.`);
    this.data = { ref };
  }
}

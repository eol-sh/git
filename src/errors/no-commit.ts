


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

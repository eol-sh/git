


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

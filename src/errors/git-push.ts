


//// util

import { BaseError } from "./base.ts";
import { PushResult } from "../types.ts";



//// export

export class GitPushError extends BaseError {
  static readonly code = "GitPushError" as const;

  constructor(prettyDetails: string, result: PushResult) {
    super(`One or more branches were not updated: ${prettyDetails}`);

    this.code = this.name = GitPushError.code;
    this.data = { prettyDetails, result };
  }
}

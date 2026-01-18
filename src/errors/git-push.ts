/**
 * @fileoverview Error thrown when git push operations fail
 * 
 * This error provides detailed information about which branches failed to push
 * and why, including the full push result for debugging.
 * 
 * @module errors/git-push
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

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

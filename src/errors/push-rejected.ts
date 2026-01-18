


/**
 * @fileoverview Push rejected error implementation
 * 
 * This error is thrown when a push operation is rejected by the remote
 * repository. Common reasons include non-fast-forward pushes that would
 * overwrite history, or attempting to push tags that already exist on
 * the remote.
 * 
 * @module errors/push-rejected
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";

type PushRejectedReason = "not-fast-forward" | "tag-exists";



//// export

export class PushRejectedError extends BaseError {
  static readonly code = "PushRejectedError" as const;

  constructor(reason: PushRejectedReason) {
    let message = "";

    if (reason === "not-fast-forward")
      message = " because it was not a simple fast-forward";
    else if (reason === "tag-exists")
      message = " because tag already exists";

    super(`Push rejected${message}. Use "force: true" to override.`);

    this.code = this.name = PushRejectedError.code;
    this.data = { reason };
  }
}

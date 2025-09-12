


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

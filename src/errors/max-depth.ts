


//// util

import { BaseError } from "./base.ts";



//// export

export class MaxDepthError extends BaseError {
  static readonly code = "MaxDepthError" as const;

  constructor(depth: number) {
    super(`Maximum search depth of ${depth} exceeded.`);

    this.code = this.name = MaxDepthError.code;
    this.data = { depth };
  }
}

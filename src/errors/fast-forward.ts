


//// util

import { BaseError } from "./base.ts";



//// export

export class FastForwardError extends BaseError {
  static readonly code = "FastForwardError" as const;

  constructor() {
    super(`A simple fast-forward merge was not possible.`);

    this.code = this.name = FastForwardError.code;
    this.data = {};
  }
}

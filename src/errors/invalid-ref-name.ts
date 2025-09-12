


//// util

import { BaseError } from "./base.ts";



//// export

export class InvalidRefNameError extends BaseError {
  static readonly code = "InvalidRefNameError" as const;

  constructor(ref: string, suggestion: string) {
    super(`"${ref}" would be an invalid git reference. (Hint: a valid alternative would be "${suggestion}".)`);

    this.code = this.name = InvalidRefNameError.code;
    this.data = { ref, suggestion };
  }
}

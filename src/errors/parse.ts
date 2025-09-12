


//// util

import { BaseError } from "./base.ts";



//// export

export class ParseError extends BaseError {
  static readonly code = "ParseError" as const;

  constructor(expected: string, actual: string) {
    super(`Expected "${expected}" but received "${actual}".`);

    this.code = this.name = ParseError.code;
    this.data = { expected, actual };
  }
}

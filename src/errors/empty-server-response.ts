


//// util

import { BaseError } from "./base.ts";



//// export

export class EmptyServerResponseError extends BaseError {
  static readonly code = "EmptyServerResponseError" as const;

  constructor() {
    super(`Empty response from git server.`);

    this.code = this.name = EmptyServerResponseError.code;
    this.data = {};
  }
}

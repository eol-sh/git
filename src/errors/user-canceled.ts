


//// util

import { BaseError } from "./base.ts";



//// export

export class UserCanceledError extends BaseError {
  static readonly code = "UserCanceledError" as const;

  constructor() {
    super(`The operation was canceled.`);

    this.code = this.name = UserCanceledError.code;
    this.data = {};
  }
}

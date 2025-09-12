


//// util

import { BaseError } from "./base.ts";



//// export

export class CheckoutConflictError extends BaseError {
  static readonly code = "CheckoutConflictError" as const;

  constructor(filepaths: string[]) {
    super(
      `Your local changes to the following files would be overwritten by checkout: ${
        filepaths.join(", ")
      }`
    );

    this.code = this.name = CheckoutConflictError.code;
    this.data = { filepaths };
  }
}

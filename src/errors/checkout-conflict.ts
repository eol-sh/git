/**
 * @fileoverview Error thrown when checkout would overwrite local changes
 * 
 * This error occurs when attempting to checkout a branch or commit that would
 * overwrite uncommitted local changes in the working directory.
 * 
 * @module errors/checkout-conflict
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

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

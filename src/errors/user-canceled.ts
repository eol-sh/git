


/**
 * @fileoverview User canceled error implementation
 * 
 * This error is thrown when a Git operation is explicitly canceled
 * by the user. This typically occurs in interactive scenarios where
 * the user chooses to abort an ongoing operation through user
 * interface interactions or interrupt signals.
 * 
 * @module errors/user-canceled
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


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

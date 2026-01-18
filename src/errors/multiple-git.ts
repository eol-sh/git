


/**
 * @fileoverview Multiple Git error implementation
 * 
 * This error is thrown when multiple Git operations fail and multiple
 * errors need to be reported together. It aggregates multiple error
 * instances into a single error object for better error handling and
 * reporting.
 * 
 * @module errors/multiple-git
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class MultipleGitError extends BaseError {
  static code = "MultipleGitError" as const;
  public override code = MultipleGitError.code;
  public override data: { errors: Error[] };
  public override name = MultipleGitError.code;
  public errors: Error[];

  constructor(errors: Error[]) {
    super(`There are multiple errors that were thrown by the method. Please refer to the "errors" property to see more`);

    this.data = { errors };
    this.errors = errors;
  }
}

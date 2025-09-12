


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

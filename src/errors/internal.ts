


//// util

import { BaseError } from "./base.ts";



//// export

export class InternalError extends BaseError {
  static code = "InternalError" as const;
  public override code = InternalError.code;
  public override data: { message: string };
  public override name = InternalError.code;

  constructor(message: string) {
    super(`An internal error caused this command to fail. Please file a bug report at https://eol.sh/~eol/git/bugs with this error message: ${message}`);
    this.data = { message };
  }
}

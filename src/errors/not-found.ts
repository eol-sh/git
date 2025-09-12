


//// util

import { BaseError } from "./base.ts";



//// export

export class NotFoundError extends BaseError {
  static code = "NotFoundError" as const;
  public override code = NotFoundError.code;
  public override data: { what: string };
  public override name = NotFoundError.code;

  constructor(what: string) {
    super(`Could not find ${what}.`);
    this.data = { what };
  }
}

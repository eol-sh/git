


/**
 * @fileoverview Not found error implementation
 * 
 * This error is thrown when a requested resource cannot be found. This is
 * a generic error that can apply to various Git objects including files,
 * commits, branches, tags, or other repository entities that are expected
 * to exist but cannot be located.
 * 
 * @module errors/not-found
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


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

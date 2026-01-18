


/**
 * @fileoverview Missing parameter error implementation
 * 
 * This error is thrown when a required function parameter is missing or
 * undefined. It helps identify when API functions are called without
 * providing mandatory arguments needed for proper execution.
 * 
 * @module errors/missing-parameter
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class MissingParameterError extends BaseError {
  static code = "MissingParameterError" as const;
  public override code = MissingParameterError.code;
  public override data: { parameter: string };
  public override name = MissingParameterError.code;

  constructor(parameter: string) {
    super(`The function requires a "${parameter}" parameter but none was provided.`);
    this.data = { parameter };
  }
}

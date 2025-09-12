


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




//// util

import { BaseError } from "./base.ts";



//// export

export class UnsafeFilepathError extends BaseError {
  static code = "UnsafeFilepathError" as const;
  public override code = UnsafeFilepathError.code;
  public override data: { filepath: string };
  public override name = UnsafeFilepathError.code;

  constructor(filepath: string) {
    super(`The filepath "${filepath}" contains unsafe character sequences`);
    this.data = { filepath };
  }
}

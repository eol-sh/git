


//// util

import { BaseError } from "./base.ts";

type InvalidFilepathReason = "directory" | "leading-slash" | "trailing-slash";



//// export

export class InvalidFilepathError extends BaseError {
  static code = "InvalidFilepathError" as const;
  public override code = InvalidFilepathError.code;
  public override data: { reason?: InvalidFilepathReason };
  public override name = InvalidFilepathError.code;

  constructor(reason?: InvalidFilepathReason) {
    let message = "invalid filepath";

    if (reason === "leading-slash" || reason === "trailing-slash")
      message = `"filepath" parameter should not include leading or trailing directory separators because these can cause problems on some platforms.`;
    else if (reason === "directory")
      message = `"filepath" should not be a directory.`;

    super(message);
    this.data = reason !== undefined ? { reason } : {};
  }
}

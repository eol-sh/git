


//// util

import { BaseError } from "./base.ts";



//// export

export class SmartHttpError extends BaseError {
  static code = "SmartHttpError" as const;
  public override code = SmartHttpError.code;
  public override data: { preview: string; response: string };
  public override name = SmartHttpError.code;

  constructor(preview: string, response: string) {
    super(`Remote did not reply using the "smart" HTTP protocol. Expected "001e# service=git-upload-pack" but received: ${preview}`);
    this.data = { preview, response };
  }
}

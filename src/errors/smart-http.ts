


/**
 * @fileoverview Smart HTTP error implementation
 * 
 * This error is thrown when a remote Git server does not respond with
 * the expected smart HTTP protocol format. Smart HTTP is Git's efficient
 * protocol for HTTP(S) communication, and this error indicates the
 * server is not properly implementing it.
 * 
 * @module errors/smart-http
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


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

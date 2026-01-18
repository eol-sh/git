/**
 * @fileoverview Error thrown for HTTP communication failures
 * 
 * This error wraps HTTP status codes and messages from failed requests
 * to Git servers over HTTP/HTTPS protocols.
 * 
 * @module errors/http
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";



//// export

export class HttpError extends BaseError {
  static readonly code = "HttpError" as const;

  constructor(statusCode: number, statusMessage: string, response: string) {
    super(`HTTP Error: ${statusCode} ${statusMessage}`);

    this.code = this.name = HttpError.code;
    this.data = { statusCode, statusMessage, response };
  }
}

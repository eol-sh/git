/**
 * @fileoverview Error thrown when a Git server returns an empty response
 * 
 * This error indicates a network or server issue where the Git server
 * responded but with no content, which is unexpected for Git protocol operations.
 * 
 * @module errors/empty-server-response
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";



//// export

export class EmptyServerResponseError extends BaseError {
  static readonly code = "EmptyServerResponseError" as const;

  constructor() {
    super(`Empty response from git server.`);

    this.code = this.name = EmptyServerResponseError.code;
    this.data = {};
  }
}

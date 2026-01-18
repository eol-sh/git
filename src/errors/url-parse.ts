


/**
 * @fileoverview URL parse error implementation
 * 
 * This error is thrown when a Git remote URL cannot be properly parsed
 * or is malformed. This typically occurs when the URL format is invalid
 * or contains syntax that doesn't conform to expected Git URL patterns.
 * 
 * @module errors/url-parse
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class UrlParseError extends BaseError {
  static readonly code = "UrlParseError" as const;

  constructor(url: string) {
    super(`Cannot parse remote URL: "${url}"`);

    this.code = this.name = UrlParseError.code;
    this.data = { url };
  }
}

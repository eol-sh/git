


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

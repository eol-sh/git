


/**
 * @fileoverview Parse error implementation
 * 
 * This error is thrown when parsing operations fail, typically when
 * expected data format or content does not match what was actually
 * received. This commonly occurs when parsing Git objects, configuration
 * files, or protocol messages.
 * 
 * @module errors/parse
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class ParseError extends BaseError {
  static readonly code = "ParseError" as const;

  constructor(expected: string, actual: string) {
    super(`Expected "${expected}" but received "${actual}".`);

    this.code = this.name = ParseError.code;
    this.data = { expected, actual };
  }
}

/**
 * @fileoverview Error thrown for invalid Git object identifiers (OIDs)
 * 
 * This error validates that object IDs are properly formatted 40-character
 * hexadecimal SHA-1 hashes as required by the Git protocol.
 * 
 * @module errors/invalid-oid
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";



//// export

export class InvalidOidError extends BaseError {
  static readonly code = "InvalidOidError" as const;

  constructor(value: string) {
    super(`Expected a 40-char hex object id but saw "${value}".`);
    this.code = this.name = InvalidOidError.code;
    this.data = { value };
  }
}

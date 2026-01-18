/**
 * @fileoverview Error thrown for invalid Git reference names
 * 
 * This error validates reference names against Git's naming rules and
 * provides suggestions for valid alternatives when a name is rejected.
 * 
 * @module errors/invalid-ref-name
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";



//// export

export class InvalidRefNameError extends BaseError {
  static readonly code = "InvalidRefNameError" as const;

  constructor(ref: string, suggestion: string) {
    super(`"${ref}" would be an invalid git reference. (Hint: a valid alternative would be "${suggestion}".)`);

    this.code = this.name = InvalidRefNameError.code;
    this.data = { ref, suggestion };
  }
}

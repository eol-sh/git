/**
 * @fileoverview Error thrown when a fast-forward merge is not possible
 * 
 * This error occurs when attempting a fast-forward merge but the branches
 * have diverged, requiring a true merge or rebase operation instead.
 * 
 * @module errors/fast-forward
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";



//// export

export class FastForwardError extends BaseError {
  static readonly code = "FastForwardError" as const;

  constructor() {
    super(`A simple fast-forward merge was not possible.`);

    this.code = this.name = FastForwardError.code;
    this.data = {};
  }
}

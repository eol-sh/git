/**
 * @fileoverview Error thrown when search depth limit is exceeded
 * 
 * This error prevents infinite recursion or excessive resource usage
 * by limiting the depth of directory traversal or object resolution.
 * 
 * @module errors/max-depth
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";



//// export

export class MaxDepthError extends BaseError {
  static readonly code = "MaxDepthError" as const;

  constructor(depth: number) {
    super(`Maximum search depth of ${depth} exceeded.`);

    this.code = this.name = MaxDepthError.code;
    this.data = { depth };
  }
}

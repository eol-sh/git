


/**
 * @fileoverview Unsafe filepath error implementation
 * 
 * This error is thrown when a filepath contains potentially dangerous
 * character sequences that could lead to security vulnerabilities
 * such as directory traversal attacks or other malicious path
 * manipulation attempts.
 * 
 * @module errors/unsafe-filepath
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class UnsafeFilepathError extends BaseError {
  static code = "UnsafeFilepathError" as const;
  public override code = UnsafeFilepathError.code;
  public override data: { filepath: string };
  public override name = UnsafeFilepathError.code;

  constructor(filepath: string) {
    super(`The filepath "${filepath}" contains unsafe character sequences`);
    this.data = { filepath };
  }
}

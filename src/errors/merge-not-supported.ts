

/**
 * @fileoverview Merge not supported error implementation
 * 
 * This error is thrown when attempting to perform a merge operation that is
 * not currently supported by the implementation. This typically occurs when
 * trying to merge changes that have conflicts, as conflict resolution is
 * not yet implemented.
 * 
 * @module errors/merge-not-supported
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class MergeNotSupportedError extends BaseError {
  static readonly code = "MergeNotSupportedError" as const;

  constructor() {
    super(`Merges with conflicts are not supported yet.`);

    this.code = this.name = MergeNotSupportedError.code;
    this.data = {};
  }
}

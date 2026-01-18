/**
 * @fileoverview Error thrown when index merge fails due to uncommitted changes
 * 
 * This error occurs when attempting operations that require a clean index,
 * but there are unstaged changes that would be lost. Users need to either
 * commit, stash, or reset their changes.
 * 
 * @module errors/index-reset
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";



//// export

export class IndexResetError extends BaseError {
  static code = "IndexResetError" as const;
  public override code = IndexResetError.code;
  public override data: { filepath: string };
  public override name = IndexResetError.code;

  constructor(filepath: string) {
    super(`Could not merge index: Entry for "${filepath}" is not up to date. Either reset the index entry to HEAD, or stage your unstaged changes.`);
    this.data = { filepath };
  }
}

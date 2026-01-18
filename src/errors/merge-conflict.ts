
/**
 * @fileoverview Merge conflict error implementation
 * 
 * This error is thrown when Git cannot automatically merge changes and manual
 * intervention is required. It occurs during merge operations when the same
 * lines or sections of files have been modified in conflicting ways between
 * branches or commits.
 * 
 * @module errors/merge-conflict
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class MergeConflictError extends BaseError {
  static readonly code = "MergeConflictError" as const;

  constructor(filepaths: string[], bothModified: string[], deleteByUs: string[], deleteByTheirs: string[]) {
    super(`Automatic merge failed with one or more merge conflicts in the following files: ${filepaths.toString()}. Fix conflicts then commit the result.`);

    this.code = this.name = MergeConflictError.code;
    this.data = { bothModified, deleteByTheirs, deleteByUs, filepaths };
  }
}

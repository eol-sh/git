


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

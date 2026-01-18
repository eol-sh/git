


/**
 * @fileoverview Unmerged paths error implementation
 * 
 * This error is thrown when attempting to modify the Git index while
 * there are unmerged files present. This typically occurs after a
 * merge conflict when files need to be resolved before any further
 * index modifications can be made.
 * 
 * @module errors/unmerged-paths
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";



//// export

export class UnmergedPathsError extends BaseError {
  static readonly code = "UnmergedPathsError" as const;

  constructor(filepaths: string[]) {
    super(`Modifying the index is not possible because you have unmerged files: ${filepaths.toString()}. Fix them up in the work tree, and then use "git add/rm" as appropriate to mark resolution and make a commit.`);

    this.code = this.name = UnmergedPathsError.code;
    this.data = { filepaths };
  }
}

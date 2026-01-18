/**
 * @fileoverview Error thrown when attempting to create a Git object that already exists
 * 
 * This error is thrown when operations try to create branches, tags, remotes,
 * or notes that already exist in the repository. Provides hints about using
 * force options when applicable.
 * 
 * @module errors/already-exists
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { BaseError } from "./base.ts";

type Noun = "branch" | "note" | "remote" | "tag";



//// export

export class AlreadyExistsError extends BaseError {
  static readonly code = "AlreadyExistsError" as const;

  constructor(noun: Noun, where: string, canForce: boolean = true) {
    super(
      `Failed to create ${noun} at ${where} because it already exists.${
        canForce ?
          ` (Hint: use "force: true" parameter to overwrite existing ${noun}.)` :
          ""
      }`
    );

    this.code = this.name = AlreadyExistsError.code;
    this.data = { canForce, noun, where };
  }
}




/**
 * @fileoverview Missing name error implementation
 * 
 * This error is thrown when attempting to create Git objects (commits, tags)
 * that require a name field but no name has been provided either as a parameter
 * or configured in the Git configuration file. This typically affects author,
 * committer, and tagger identities.
 * 
 * @module errors/missing-name
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { BaseError } from "./base.ts";

type Role = "author" | "committer" | "tagger";



//// export

export class MissingNameError extends BaseError {
  static readonly code = "MissingNameError" as const;

  constructor(role: Role) {
    super(`No name was provided for ${role} in the argument or in the .git/config file.`);

    this.code = this.name = MissingNameError.code;
    this.data = { role };
  }
}

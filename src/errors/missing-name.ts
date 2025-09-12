


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

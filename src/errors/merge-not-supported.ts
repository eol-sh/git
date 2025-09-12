


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

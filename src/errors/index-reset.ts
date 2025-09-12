


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

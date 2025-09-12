


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

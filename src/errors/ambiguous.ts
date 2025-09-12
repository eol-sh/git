


//// util

import { BaseError } from "./base.ts";

type Nouns = "oids" | "refs";



//// export

export class AmbiguousError extends BaseError {
  static readonly code = "AmbiguousError" as const;

  constructor(nouns: Nouns, short: string, matches: string[]) {
    super(
      `Found multiple ${nouns} matching "${short}" (${
        matches.join(", ")
      }). Use a longer abbreviation length to disambiguate them.`
    );

    this.code = this.name = AmbiguousError.code;
    this.data = { matches, nouns, short };
  }
}

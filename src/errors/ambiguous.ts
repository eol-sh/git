/**
 * @fileoverview Error thrown when a Git reference or object ID is ambiguous
 * 
 * This error occurs when a shortened OID or ref matches multiple objects
 * in the repository. Users need to provide a longer abbreviation to disambiguate.
 * 
 * @module errors/ambiguous
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

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

/**
 * @fileoverview mode2type utility functions
 *
 * Utility functions for mode2type operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/mode2type.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { InternalError } from "../errors/internal.ts";

type GitObjectType = "blob" | "commit" | "tree";



//// export

export function mode2type(mode: number): GitObjectType {
  switch(mode) {
    case 0o040000: {
      return "tree";
    }

    case 0o100644: {
      return "blob";
    }

    case 0o100755: {
      return "blob";
    }

    case 0o120000: {
      return "blob";
    }

    case 0o160000: {
      return "commit";
    }
  }

  throw new InternalError(`Unexpected GitTree entry mode: ${mode.toString(8)}`);
}

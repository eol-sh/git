/**
 * @fileoverview compare-path utility functions
 *
 * Utility functions for compare-path operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/compare-path.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { compareStrings } from "./compare-strings.ts";

interface PathEntry {
  path: string;
}



//// export

export function comparePath(a: PathEntry, b: PathEntry): number {
  /*** https://stackoverflow.com/a/40355107 ***/
  return compareStrings(a.path, b.path);
}

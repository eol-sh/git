/**
 * @fileoverview compare-age utility functions
 *
 * Utility functions for compare-age operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/compare-age.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import type { CommitObject } from "../types.ts";



//// export

export function compareAge(a: CommitObject, b: CommitObject): number {
  return a.committer.timestamp - b.committer.timestamp;
}

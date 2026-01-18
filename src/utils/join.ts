/**
 * @fileoverview join utility functions
 *
 * Utility functions for join operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/join.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// import

import { join as denoJoin } from "jsr:@std/path@1.1.2/join";




//// export

export function join(...paths: string[]): string {
  return denoJoin(...(paths as [string, ...string[]]));
}

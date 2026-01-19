/**
 * @fileoverview array-range utility functions
 *
 * Utility functions for array-range operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/array-range.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

/*** EXPORT ------------------------------------------- ***/

export function arrayRange(start: number, end: number): number[] {
  const length = end - start;
  return Array.from({ length }, (_, i) => start + i);
}



/*** via https://dev.to/namirsab/comment/2050 ***/

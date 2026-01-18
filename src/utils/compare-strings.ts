/**
 * @fileoverview compare-strings utility functions
 *
 * Utility functions for compare-strings operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/compare-strings.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function compareStrings(a: string, b: string): number {
  /*** https://stackoverflow.com/a/40355107 ***/
  return -(a < b) || +(a > b);
}

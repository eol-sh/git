/**
 * @fileoverview normalize-newlines utility functions
 *
 * Utility functions for normalize-newlines operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/normalize-newlines.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function normalizeNewlines(str: string): string {
  /*** remove all <CR> ***/
  str = str.replace(/\r/g, "");
  /*** no extra newlines up front ***/
  str = str.replace(/^\n+/, "");
  /*** and a single newline at the end ***/
  str = str.replace(/\n+$/, "") + "\n";

  return str;
}

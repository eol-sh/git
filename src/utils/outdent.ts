/**
 * @fileoverview outdent utility functions
 *
 * Utility functions for outdent operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/outdent.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function outdent(str: string): string {
  return str
    .split("\n")
    .map((x) => x.replace(/^ /, ""))
    .join("\n");
}

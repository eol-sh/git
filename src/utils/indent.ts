/**
 * @fileoverview indent utility functions
 *
 * Utility functions for indent operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/indent.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function indent(str: string): string {
  return (
    str
      .trim()
      .split("\n")
      .map((x) => " " + x)
      .join("\n") + "\n"
  );
}

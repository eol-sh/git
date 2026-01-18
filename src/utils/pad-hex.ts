/**
 * @fileoverview pad-hex utility functions
 *
 * Utility functions for pad-hex operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/pad-hex.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function padHex(b: number, n: number): string {
  const s = n.toString(16);
  return "0".repeat(b - s.length) + s;
}

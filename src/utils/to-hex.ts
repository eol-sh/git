/**
 * @fileoverview to-hex utility functions
 *
 * Utility functions for to-hex operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/to-hex.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function toHex(buffer: ArrayBuffer | Uint8Array): string {
  let hex = "";

  for (const byte of new Uint8Array(buffer)) {
    if (byte < 16)
      hex += "0";

    hex += byte.toString(16);
  }

  return hex;
}

/**
 * @fileoverview posixify-path-buffer utility functions
 *
 * Utility functions for posixify-path-buffer operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/posixify-path-buffer.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function posixifyPathBuffer(buffer: Uint8Array): Uint8Array {
  let idx: number;

  while (~(idx = buffer.indexOf(92)))
    buffer[idx] = 47;

  return buffer;
}

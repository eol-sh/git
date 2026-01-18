/**
 * @fileoverview empty-packfile utility functions
 *
 * Utility functions for empty-packfile operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/empty-packfile.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

/**
 * Check if a packfile is empty (contains no objects)
 */
export function emptyPackfile(pack: Uint8Array): boolean {
  return getPackObjectCount(pack) === 0;
}

/**
 * Get the number of objects in a packfile
 */
export function getPackObjectCount(pack: Uint8Array): number {
  if (pack.length < 12)
    return -1; /*** Invalid pack ***/

  /*** Check for valid pack header "PACK" (0x5041434b) ***/
  if (pack[0] !== 0x50 || pack[1] !== 0x41 || pack[2] !== 0x43 || pack[3] !== 0x4b)
    return -1; /*** Invalid pack header ***/

  /*** Read object count from bytes 8-11 (big endian) ***/
  return (pack[8] << 24) | (pack[9] << 16) | (pack[10] << 8) | pack[11];
}

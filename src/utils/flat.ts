/**
 * @fileoverview flat utility functions
 *
 * Utility functions for flat operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/flat.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export const flat = <T>(entries: T[][]): T[] => {
  return typeof Array.prototype.flat === "undefined" ?
    entries.reduce((acc, x) => acc.concat(x), []) :
    entries.flat();
};

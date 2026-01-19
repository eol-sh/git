/**
 * @fileoverview assign-defined utility functions
 *
 * Utility functions for assign-defined operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/assign-defined.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

/*** EXPORT ------------------------------------------- ***/

export function assignDefined<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  for (const source of sources) {
    if (source) {
      for (const key of Object.keys(source)) {
        const val = source[key];

        if (val !== undefined)
          (target as any)[key] = val;
      }
    }
  }

  return target;
}



/*** Like Object.assign but ignore properties with undefined values
     ref: https://stackoverflow.com/q/39513815 ***/

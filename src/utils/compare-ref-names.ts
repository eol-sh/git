/**
 * @fileoverview compare-ref-names utility functions
 *
 * Utility functions for compare-ref-names operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/compare-ref-names.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function compareRefNames(a: string, b: string): number {
  /*** https://stackoverflow.com/a/40355107 ***/
  const _a = a.replace(/\^\{\}$/, "");
  const _b = b.replace(/\^\{\}$/, "");
  const tmp = -(_a < _b) || +(_a > _b);

  if (tmp === 0)
    return a.endsWith("^{}") ? 1 : -1;

  return tmp;
}

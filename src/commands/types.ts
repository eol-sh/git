

/**
 * @fileoverview Git types command implementation
 *
 * Internal implementation of the types Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/types.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// export

export const types = {
  blob: 0b0110000,
  commit: 0b0010000,
  ofs_delta: 0b1100000,
  ref_delta: 0b1110000,
  tag: 0b1000000,
  tree: 0b0100000
} as const;

export type GitObjectType = keyof typeof types;

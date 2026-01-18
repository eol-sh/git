/**
 * @fileoverview from-entries utility functions
 *
 * Utility functions for from-entries operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/from-entries.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function fromEntries<K extends string | number | symbol, V>(map: Map<K, V> | [K, V][]): Record<K, V> {
  const o = {} as Record<K, V>;

  const entries = Array.isArray(map) ?
    map :
    map.entries();

  for (const [key, value] of entries) {
    o[key] = value;
  }

  return o;
}

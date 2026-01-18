/**
 * @fileoverview deep-map utility functions
 *
 * Utility functions for deep-map operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/deep-map.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

const deepget = <T>(keys: string[], map: Map<string, any>): Map<string, T> => {
  for (const key of keys) {
    if (!map.has(key))
      map.set(key, new Map());

    map = map.get(key);
  }

  return map;
};



//// export

export class DeepMap<T = any> {
  private _root = new Map<string, any>();

  get(keys: string[]): T | undefined {
    const keysCopy = [...keys]; /*** Don’t mutate the original array ***/
    const lastKey = keysCopy.pop()!;
    const lastMap = deepget<T>(keysCopy, this._root);

    return lastMap.get(lastKey);
  }

  has(keys: string[]): boolean {
    const keysCopy = [...keys]; /*** Don’t mutate the original array ***/
    const lastKey = keysCopy.pop()!;
    const lastMap = deepget<T>(keysCopy, this._root);

    return lastMap.has(lastKey);
  }

  set(keys: string[], value: T): void {
    const keysCopy = [...keys]; /*** Don’t mutate the original array ***/
    const lastKey = keysCopy.pop()!;
    const lastMap = deepget<T>(keysCopy, this._root);

    lastMap.set(lastKey, value);
  }
}

/**
 * @fileoverview types utility functions
 *
 * Utility functions for types operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/types.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function isFunction(obj: unknown) {
  return typeof obj === "function";
}

export function isObject(obj: unknown): obj is object {
  return obj !== null && typeof obj === "object";
}

export function isPromiseLike(obj: unknown): obj is Promise<unknown> {
  return isObject(obj) &&
    "then" in obj &&
    isFunction((obj as any).then) &&
    "catch" in obj &&
    isFunction((obj as any).catch);
}

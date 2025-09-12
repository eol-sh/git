


//// util

import { createFileSystem } from "./default-filesystem.ts";
import { request } from "../http/web/index.ts";



//// export

/**
 * Simple utilities that provide common defaults for Git operations in Deno.
 * These help reduce boilerplate by providing pre-configured options.
 */

/**
 * Common default author for commits (when not specified)
 */
export function createAuthor(name: string, email: string) {
  return {
    email,
    name,
    timestamp: Math.floor(Date.now() / 1000),
    timezoneOffset: new Date().getTimezoneOffset()
  };
}

/**
 * Get common defaults for Git operations in Deno.
 * Returns filesystem and http client instances.
 */
export function getDefaults() {
  return {
    fs: createFileSystem(),
    http: request
  };
}

/**
 * Get options for Git operations with common defaults.
 * Merges provided options with filesystem and http defaults.
 */
export function withDefaults<T extends Record<string, any>>(options: T): T & { fs: any; http: any } {
  const defaults = getDefaults();

  return {
    ...defaults,
    ...options
  };
}

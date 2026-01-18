/**
 * @fileoverview Git resolve-ref command implementation
 *
 * Internal implementation of the resolve-ref Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/resolve-ref.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 *//**
 * Internal resolve ref command
 */

import { GitRefManager } from "../managers/git-ref.ts";
import { FileSystem } from "../models/file-system.ts";
import type { Cache } from "../types.ts";

interface ResolveRefOptions {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  ref: string;
  depth?: number;
}

/**
 * Internal function to resolve a ref to its OID
 */
export async function _resolveRef({
  // cache,
  fs,
  gitdir,
  ref,
  depth
}: ResolveRefOptions): Promise<string | null> {
  try {
    return await GitRefManager.resolve({
      fs: fs as any,
      gitdir,
      ref,
      depth
    });
  } catch {
    // Return null if ref cannot be resolved
    return null;
  }
}

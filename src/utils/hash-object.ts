/**
 * @fileoverview hash-object utility functions
 *
 * Utility functions for hash-object operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/hash-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { GitObject } from "../models/git-object.ts";
import { shasum } from "../utils/shasum.ts";

interface HashObjectOptions {
  gitdir?: string;
  object: Uint8Array;
  type: "blob" | "commit" | "tag" | "tree";
}



//// export

export async function hashObject({ gitdir: _gitdir, object, type }: HashObjectOptions): Promise<string> {
  return await shasum(GitObject.wrap({ object, type }));
}

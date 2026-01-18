/**
 * @fileoverview Git expand-ref API - High-level user interface
 *
 * This module provides the public API for expand-ref operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/expand-ref.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface ExpandRefOptions {
  cache?: Cache;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  ref: string;
}



//// export

/**
 * Expand an abbreviated ref to its full name
 */
export async function expandRef({
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  ref
}: ExpandRefOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);
    const unifiedFs = adaptFsInterface(_fs);

    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);

    return await GitRefManager.expand({
      fs: unifiedFs,
      gitdir,
      ref
    });
  } catch(err: unknown) {
    (err as any).caller = "git.expandRef";
    throw err;
  }
}

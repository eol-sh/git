/**
 * @fileoverview Git list-refs API - High-level user interface
 *
 * This module provides the public API for list-refs operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/list-refs.ts
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

interface ListRefsOptions {
  cache?: Cache;
  dir?: string;
  filepath?: string;
  fs: FsClient;
  gitdir?: string;
}



//// export

/**
 * List refs
 */
export function listRefs({
  dir,
  filepath,
  fs,
  gitdir = join(dir!, ".git"),
}: ListRefsOptions): Promise<string[]> {
  const unifiedFs = adaptFsInterface(fs);

  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);

    return GitRefManager.listRefs({
      filepath: filepath || "refs",
      fs: unifiedFs,
      gitdir
    });
  } catch(err: unknown) {
    (err as any).caller = "git.listRefs";
    throw err;
  }
}

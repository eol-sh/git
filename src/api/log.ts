/**
 * @fileoverview Git log API - High-level user interface
 *
 * This module provides the public API for log operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/log.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _log } from "../commands/log.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient, ReadCommitResult } from "../types.ts";

interface LogOptions {
  cache?: Cache;
  depth?: number;
  dir?: string;
  filepath?: string;
  follow?: boolean;
  fs: FsClient;
  gitdir?: string;
  ref?: string;
  since?: Date;
}



//// export

/**
 * Get commit descriptions from the git history
 */
export async function log({
  cache = new Map(),
  depth,
  dir,
  filepath,
  follow,
  fs,
  gitdir = join(dir!, ".git"),
  ref = "HEAD",
  since
}: LogOptions): Promise<ReadCommitResult[]> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);

    return await _log({
      cache,
      ...(depth !== undefined ? { depth } : {}),
      ...(filepath !== undefined ? { filepath } : {}),
      ...(follow !== undefined ? { follow } : {}),
      fs: adaptFsInterface(fs),
      gitdir,
      ref,
      ...(since !== undefined ? { since } : {})
    });
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.log";
    throw error;
  }
}

/**
 * @fileoverview Git get-config API - High-level user interface
 *
 * This module provides the public API for get-config operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/get-config.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _getConfig } from "../commands/get-config.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface GetConfigOptions {
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  path: string;
}



//// export

/**
 * Read an entry from the git config files.
 */
export async function getConfig({
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  path
}: GetConfigOptions): Promise<any> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("path", path);

    return await _getConfig({
      fs,
      gitdir,
      path
    });
  } catch(err: unknown) {
    (err as any).caller = "git.getConfig";
    throw err;
  }
}

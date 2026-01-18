/**
 * @fileoverview Git get-config-all API - High-level user interface
 *
 * This module provides the public API for get-config-all operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/get-config-all.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _getConfigAll } from "../commands/get-config-all.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface GetConfigAllOptions {
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  path: string;
}



//// export

/**
 * Read a multi-valued entry from the git config files.
 *
 * *Caveats:*
 * - Currently only the local `$GIT_DIR/config` file can be read or written. However support for the global `~/.gitconfig` and system `$(prefix)/etc/gitconfig` will be added in the future.
 * - The current parser does not support the more exotic features of the git-config file format such as `[include]` and `[includeIf]`.
 */
export async function getConfigAll({
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  path
}: GetConfigAllOptions): Promise<any[]> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("path", path);

    return await _getConfigAll({
      fs,
      gitdir,
      path
    });
  } catch(err: unknown) {
    (err as any).caller = "git.getConfigAll";
    throw err;
  }
}

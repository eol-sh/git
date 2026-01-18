/**
 * @fileoverview Git current-branch API - High-level user interface
 *
 * This module provides the public API for current-branch operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/current-branch.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _currentBranch } from "../commands/current-branch.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface CurrentBranchOptions {
  dir?: string;
  fs: FsClient;
  fullname?: boolean;
  gitdir?: string;
  test?: boolean;
}



//// export

/**
 * Get the name of the branch currently pointed to by .git/HEAD
 */
export async function currentBranch({
  dir,
  fs: _fs,
  fullname = false,
  gitdir = join(dir!, ".git"),
  test = false
}: CurrentBranchOptions): Promise<string | undefined> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);

    const fs = adaptFileSystem(new FileSystem(_fs));

    return await _currentBranch({
      fs,
      fullname,
      gitdir,
      test
    });
  } catch(err: unknown) {
    (err as any).caller = "git.currentBranch";
    throw err;
  }
}

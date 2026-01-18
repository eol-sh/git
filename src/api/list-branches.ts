/**
 * @fileoverview Git list-branches API - High-level user interface
 *
 * This module provides the public API for list-branches operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/list-branches.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface ListBranchesOptions {
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  remote?: string;
}



//// export

/**
 * List branches
 */
export function listBranches({
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  remote
}: ListBranchesOptions): Promise<string[]> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);

    return GitRefManager.listBranches({
      fs: adaptFsInterface(fs),
      gitdir,
      ...(remote !== undefined ? { remote } : {})
    });
  } catch(err: unknown) {
    (err as any).caller = "git.listBranches";
    throw err;
  }
}

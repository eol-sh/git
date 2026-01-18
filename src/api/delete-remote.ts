/**
 * @fileoverview Git delete-remote API - High-level user interface
 *
 * This module provides the public API for delete-remote operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/delete-remote.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _deleteRemote } from "../commands/delete-remote.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface DeleteRemoteOptions {
  cache?: Cache;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  remote: string;
}



//// export

/**
 * Removes the local config entry for a given remote
 */
export async function deleteRemote({
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  remote
}: DeleteRemoteOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);

    const fs = adaptFileSystem(new FileSystem(_fs));
    assertParameter("remote", remote);

    return await _deleteRemote({
      fs,
      gitdir,
      remote
    });
  } catch(err: unknown) {
    (err as any).caller = "git.deleteRemote";
    throw err;
  }
}

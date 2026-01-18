/**
 * @fileoverview Git list-remotes API - High-level user interface
 *
 * This module provides the public API for list-remotes operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/list-remotes.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _listRemotes } from "../commands/list-remotes.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface ListRemotesOptions {
  cache?: Cache;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
}

interface RemoteInfo {
  remote: string;
  url: string;
}



//// export

/**
 * List remotes
 */
export async function listRemotes({
  dir,
  fs,
  gitdir = join(dir!, ".git")
}: ListRemotesOptions): Promise<RemoteInfo[]> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);

    return await _listRemotes({ fs: adaptFileSystem(new FileSystem(fs)), gitdir });
  } catch(err: unknown) {
    (err as any).caller = "git.listRemotes";
    throw err;
  }
}

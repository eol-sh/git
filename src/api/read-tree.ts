/**
 * @fileoverview Git read-tree API - High-level user interface
 *
 * This module provides the public API for read-tree operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/read-tree.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _readTree } from "../commands/read-tree.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsInterface, ReadTreeResult } from "../types.ts";

interface ReadTreeOptions {
  cache?: Cache;
  dir?: string;
  filepath?: string;
  fs: FsInterface;
  gitdir?: string;
  oid: string;
}



//// export

/**
 * Read a tree object directly
 */
export async function readTree({
  cache = new Map(),
  dir,
  filepath = undefined,
  fs,
  gitdir = join(dir!, ".git"),
  oid
}: ReadTreeOptions): Promise<ReadTreeResult> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    return await _readTree({
      cache,
      ...(filepath !== undefined ? { filepath } : {}),
      fs: adaptFileSystem(new FileSystem(fs)),
      gitdir,
      oid
    });
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.readTree";

    throw error;
  }
}

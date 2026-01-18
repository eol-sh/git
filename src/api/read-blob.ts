/**
 * @fileoverview Git read-blob API - High-level user interface
 *
 * This module provides the public API for read-blob operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/read-blob.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _readBlob } from "../commands/read-blob.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient, ReadBlobResult } from "../types.ts";

interface ReadBlobOptions {
  cache?: Cache;
  dir?: string;
  filepath?: string;
  fs: FsClient;
  gitdir?: string;
  oid: string;
}



//// export

/**
 * Read a blob object directly
 */
export async function readBlob({
  cache = new Map(),
  dir,
  filepath,
  fs,
  gitdir = join(dir!, ".git"),
  oid
}: ReadBlobOptions): Promise<ReadBlobResult> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    return await _readBlob({
      cache,
      ...(filepath !== undefined ? { filepath } : {}),
      fs: adaptFileSystem(new FileSystem(fs)),
      gitdir,
      oid
    });
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.readBlob";

    throw error;
  }
}

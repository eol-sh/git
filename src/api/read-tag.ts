/**
 * @fileoverview Git read-tag API - High-level user interface
 *
 * This module provides the public API for read-tag operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/read-tag.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _readTag } from "../commands/read-tag.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsInterface, ReadTagResult } from "../types.ts";



//// export

export interface ReadTagOptions {
  cache?: Cache;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  oid: string;
}

/**
 * Read an annotated tag object directly
 *
 * @param args - The options for readTag
 * @param args.fs - a file system client
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.oid - The SHA-1 object id to get
 * @param args.cache - a [cache](cache.md) object
 *
 * @returns Resolves successfully with a git object description
 */
export async function readTag({
  cache = new Map(),
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  oid
}: ReadTagOptions): Promise<ReadTagResult> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    return await _readTag({
      cache,
      fs: adaptFileSystem(new FileSystem(fs)),
      gitdir,
      oid
    });
  } catch(err: unknown) {
    (err as any).caller = "git.readTag";
    throw err;
  }
}

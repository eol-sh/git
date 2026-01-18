/**
 * @fileoverview Git write-blob API - High-level user interface
 *
 * This module provides the public API for write-blob operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/write-blob.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

import { _writeObject } from "../storage/write-object.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { FsInterface } from "../types.ts";



//// export

export interface WriteBlobOptions {
  blob: Uint8Array;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
}

/**
 * Write a blob object directly
 *
 * @param args - The options for writeBlob
 * @param args.fs - a file system client
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.blob - The blob object to write
 *
 * @returns Resolves successfully with the SHA-1 object id of the newly written object
 *
 * @example
 * // Manually create a blob.
 * let oid = await git.writeBlob({
 *   blob: new Uint8Array([]),
 *   dir: "/tutorial",
 *   fs
 * });
 *
 * console.log("oid", oid); // should be "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391"
 */
export async function writeBlob({
  blob,
  dir,
  fs,
  gitdir = join(dir!, ".git")
}: WriteBlobOptions): Promise<string> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("blob", blob);

    return await _writeObject({
      format: "content",
      fs: adaptFsInterface(fs),
      gitdir,
      object: blob,
      type: "blob"
    });
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.writeBlob";

    throw error;
  }
}

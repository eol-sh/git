/**
 * @fileoverview Git write-ref API - High-level user interface
 *
 * This module provides the public API for write-ref operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/write-ref.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// import

import cleanGitRef from "clean-git-ref";

//// util

import { adaptFsForGitRef } from "../utils/fs-adapter.ts";
import { AlreadyExistsError } from "../errors/already-exists.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { InvalidRefNameError } from "../errors/invalid-ref-name.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface WriteRefOptions {
  cache?: Cache;
  dir?: string;
  force?: boolean;
  fs: FsClient;
  gitdir?: string;
  ref: string;
  symbolic?: boolean;
  value: string;
}



//// export

/**
 * Write a ref which refers to the specified SHA-1 object id, or a symbolic ref which refers to the specified ref.
 */
export async function writeRef({
  dir,
  force = false,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  ref,
  symbolic = false,
  value
}: WriteRefOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);
    assertParameter("value", value);

    const fs = new FileSystem(_fs);

    if (ref !== cleanGitRef.clean(ref))
      throw new InvalidRefNameError(ref, cleanGitRef.clean(ref));

    if (!force && (await GitRefManager.exists({ fs: adaptFsForGitRef(fs), gitdir, ref })))
      throw new AlreadyExistsError("branch", ref);

    if (symbolic) {
      await GitRefManager.writeSymbolicRef({
        fs: adaptFsForGitRef(fs),
        gitdir,
        ref,
        value
      });
    } else {
      value = await GitRefManager.resolve({
        fs: adaptFsForGitRef(fs),
        gitdir,
        ref: value
      });
      await GitRefManager.writeRef({
        fs: adaptFsForGitRef(fs),
        gitdir,
        ref,
        value
      });
    }
  } catch(err: unknown) {
    (err as any).caller = "git.writeRef";
    throw err;
  }
}

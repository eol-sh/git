/**
 * @fileoverview Git add-remote API - High-level user interface
 *
 * This module provides the public API for add-remote operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/add-remote.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { _addRemote } from "../commands/add-remote.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface AddRemoteOptions {
  dir?: string;
  force?: boolean;
  fs: FsClient;
  gitdir?: string;
  remote: string;
  url: string;
}



//// export

/**
 * Add or update a remote
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.remote - The name of the remote
 * @param {string} args.url - The URL of the remote
 * @param {boolean} [args.force = false] - Instead of throwing an error if a remote named `remote` already exists, overwrite the existing remote.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.addRemote({
 *   dir: "/tutorial",
 *   fs,
 *   remote: "upstream",
 *   url: "https://eol.sh/~eol/git"
 * });
 *
 * console.log("done");
 */
export async function addRemote({
  dir,
  force = false,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  remote,
  url
}: AddRemoteOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("remote", remote);
    assertParameter("url", url);

    const fs = adaptFileSystem(new FileSystem(_fs));

    return await _addRemote({
      force,
      fs,
      gitdir,
      remote,
      url
    });
  } catch(err: unknown) {
    (err as any).caller = "git.addRemote";
    throw err;
  }
}

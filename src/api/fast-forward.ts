/**
 * @fileoverview Git fast-forward API - High-level user interface
 *
 * This module provides the public API for fast-forward operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/fast-forward.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { _pull } from "../commands/pull.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
  Cache,
  FsClient,
  HttpClient,
  MessageCallback,
  ProgressCallback
} from "../types.ts";

interface FastForwardOptions {
  cache?: Cache;
  corsProxy?: string;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  headers?: Record<string, string>;
  http: HttpClient;
  onAuth?: AuthCallback;
  onAuthFailure?: AuthFailureCallback;
  onAuthSuccess?: AuthSuccessCallback;
  onMessage?: MessageCallback;
  onProgress?: ProgressCallback;
  ref?: string;
  remote?: string;
  remoteRef?: string;
  singleBranch?: boolean;
  url?: string;
}



//// export

/**
 * Like `pull`, but hard-coded with `fastForward: true` so there is no need for an `author` parameter.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {HttpClient} args.http - an HTTP client
 * @param {ProgressCallback} [args.onProgress] - optional progress event callback
 * @param {MessageCallback} [args.onMessage] - optional message event callback
 * @param {AuthCallback} [args.onAuth] - optional auth fill callback
 * @param {AuthFailureCallback} [args.onAuthFailure] - optional auth rejected callback
 * @param {AuthSuccessCallback} [args.onAuthSuccess] - optional auth approved callback
 * @param {string} args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.ref] - Which branch to merge into. By default this is the currently checked out branch.
 * @param {string} [args.url] - (Added in 1.1.0) The URL of the remote repository. The default is the value set in the git config for that remote.
 * @param {string} [args.remote] - (Added in 1.1.0) If URL is not specified, determines which remote to use.
 * @param {string} [args.remoteRef] - (Added in 1.1.0) The name of the branch on the remote to fetch. By default this is the configured remote tracking branch.
 * @param {string} [args.corsProxy] - Optional [CORS proxy](https://www.npmjs.com/%40isomorphic-git/cors-proxy). Overrides value in repo config.
 * @param {boolean} [args.singleBranch = false] - Instead of the default behavior of fetching all the branches, only fetch a single branch.
 * @param {Object<string, string>} [args.headers] - Additional headers to include in HTTP requests, similar to git’s `extraHeader` config
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<void>} Resolves successfully when pull operation completes
 *
 * @example
 * await git.fastForward({
 *   dir: "/tutorial",
 *   fs,
 *   http,
 *   ref: "main",
 *   singleBranch: true
 * });
 *
 * console.log("done");
 */
export async function fastForward({
  cache = new Map(),
  corsProxy,
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  headers = {},
  http,
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  onMessage,
  onProgress,
  ref,
  remote,
  remoteRef,
  singleBranch,
  url
}: FastForwardOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);

    const fs = adaptFileSystem(new FileSystem(_fs));

    const thisWillNotBeUsed = {
      email: "",
      name: "",
      timestamp: Date.now(),
      timezoneOffset: 0
    };

    return await _pull({
      author: thisWillNotBeUsed,
      cache,
      committer: thisWillNotBeUsed,
      ...(corsProxy !== undefined ? { corsProxy } : {}),
      dir: dir!,
      fastForwardOnly: true,
      fs,
      gitdir,
      headers,
      http,
      ...(onAuth !== undefined ? { onAuth } : {}),
      ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
      ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
      ...(onMessage !== undefined ? { onMessage } : {}),
      ...(onProgress !== undefined ? { onProgress } : {}),
      ...(ref !== undefined ? { ref } : {}),
      ...(remote !== undefined ? { remote } : {}),
      ...(remoteRef !== undefined ? { remoteRef } : {}),
      ...(singleBranch !== undefined ? { singleBranch } : {}),
      ...(url !== undefined ? { url } : {})
    });
  } catch(err: unknown) {
    (err as any).caller = "git.fastForward";
    throw err;
  }
}

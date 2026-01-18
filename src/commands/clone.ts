/**
 * @fileoverview Git clone command implementation
 *
 * Internal implementation of the clone Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/clone.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { _addRemote } from "./add-remote.ts";
import { _checkout } from "./checkout.ts";
import { _fetch } from "./fetch.ts";
import { _init } from "./init.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitConfigManager } from "../managers/git-config.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
  Cache,
  FsInterface,
  HttpClient,
  MessageCallback,
  PostCheckoutCallback,
  ProgressCallback
} from "../types.ts";

interface CloneOptions {
  batchSize?: number;
  cache: Cache;
  corsProxy?: string;
  depth?: number;
  dir?: string;
  exclude?: string[];
  fs: FsInterface;
  gitdir: string;
  headers?: Record<string, string>;
  http: HttpClient;
  noCheckout?: boolean;
  nonBlocking?: boolean;
  noTags?: boolean;
  onAuth?: AuthCallback;
  onAuthFailure?: AuthFailureCallback;
  onAuthSuccess?: AuthSuccessCallback;
  onMessage?: MessageCallback;
  onPostCheckout?: PostCheckoutCallback;
  onProgress?: ProgressCallback;
  ref?: string;
  relative?: boolean;
  remote: string;
  since?: Date;
  singleBranch?: boolean;
  url: string;
}



//// export

export async function _clone({
  fs,
  cache,
  http,
  onProgress,
  onMessage,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onPostCheckout,
  dir,
  gitdir,
  url,
  corsProxy,
  ref,
  remote,
  depth,
  since,
  exclude,
  relative,
  singleBranch,
  noCheckout,
  noTags,
  headers,
  nonBlocking,
  batchSize = 100,
}: CloneOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);

  try {
    await _init({ fs, gitdir });
    await _addRemote({ force: false, fs, gitdir, remote, url });

    if (corsProxy) {
      const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });

      await config.set(`http.corsProxy`, corsProxy);
      await GitConfigManager.save({ config, fs: unifiedFs, gitdir });
    }

    const { defaultBranch, fetchHead } = await _fetch({
      cache,
      ...(corsProxy !== undefined ? { corsProxy } : {}),
      ...(depth !== undefined ? { depth } : {}),
      ...(exclude !== undefined ? { exclude } : {}),
      fs,
      gitdir,
      ...(headers !== undefined ? { headers } : {}),
      http,
      ...(onAuth !== undefined ? { onAuth } : {}),
      ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
      ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
      ...(onMessage !== undefined ? { onMessage } : {}),
      ...(onProgress !== undefined ? { onProgress } : {}),
      ...(ref !== undefined ? { ref } : {}),
      ...(relative !== undefined ? { relative } : {}),
      ...(remote !== undefined ? { remote } : {}),
      ...(since !== undefined ? { since } : {}),
      ...(singleBranch !== undefined ? { singleBranch } : {}),
      tags: !noTags
    });

    if (fetchHead === null)
      return;

    ref = ref || defaultBranch || "main";
    ref = ref?.replace("refs/heads/", "");

    /*** Checkout that branch ***/
    await _checkout({
      ...(batchSize !== undefined ? { batchSize } : {}),
      cache,
      dir: dir || gitdir.replace(/\.git$/, ""),
      fs,
      gitdir,
      ...(noCheckout !== undefined ? { noCheckout } : {}),
      ...(nonBlocking !== undefined ? { nonBlocking } : {}),
      ...(onPostCheckout !== undefined ? { onPostCheckout } : {}),
      ...(onProgress !== undefined ? { onProgress } : {}),
      ref,
      ...(remote !== undefined ? { remote } : {})
    });
  } catch(err) {
    /*** Remove partial local repository, see #1283
    Ignore any error as we are already failing.
    The catch is necessary so the original error is not masked. ***/
    await fs
      .rmdir(gitdir)
      .catch(() => undefined);

    throw err;
  }
}

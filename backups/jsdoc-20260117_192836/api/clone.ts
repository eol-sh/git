


//// util

import { _clone } from "../commands/clone.ts";
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
  PostCheckoutCallback,
  ProgressCallback
} from "../types.ts";

interface CloneOptions {
  batchSize?: number;
  cache?: Cache;
  corsProxy?: string;
  depth?: number;
  dir: string;
  exclude?: string[];
  fs: FsClient;
  gitdir?: string;
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
  remote?: string;
  since?: Date;
  singleBranch?: boolean;
  url: string;
}



//// export

/**
 * Clone a repository
 */
export async function clone({
  batchSize = 100,
  cache = new Map(),
  corsProxy = undefined,
  depth = undefined,
  dir,
  exclude = [],
  fs: _fs,
  gitdir = join(dir, ".git"),
  headers = {},
  http,
  noCheckout = false,
  nonBlocking = false,
  noTags = false,
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  onMessage,
  onPostCheckout,
  onProgress,
  ref = undefined,
  relative = false,
  remote = "origin",
  since = undefined,
  singleBranch = false,
  url
}: CloneOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    const fs = adaptFileSystem(new FileSystem(_fs));

    assertParameter("http", http);
    assertParameter("gitdir", gitdir);

    if (!noCheckout)
      assertParameter("dir", dir);

    assertParameter("url", url);

    const options: any = {
      cache,
      dir,
      exclude,
      fs,
      gitdir,
      headers,
      url
    };

    if (batchSize !== undefined)
      options.batchSize = batchSize;

    if (corsProxy !== undefined)
      options.corsProxy = corsProxy;

    if (depth !== undefined)
      options.depth = depth;

    if (http !== undefined)
      options.http = http;

    if (noCheckout !== undefined)
      options.noCheckout = noCheckout;

    if (nonBlocking !== undefined)
      options.nonBlocking = nonBlocking;

    if (noTags !== undefined)
      options.noTags = noTags;

    if (onAuth !== undefined)
      options.onAuth = onAuth;

    if (onAuthFailure !== undefined)
      options.onAuthFailure = onAuthFailure;

    if (onAuthSuccess !== undefined)
      options.onAuthSuccess = onAuthSuccess;

    if (onMessage !== undefined)
      options.onMessage = onMessage;

    if (onPostCheckout !== undefined)
      options.onPostCheckout = onPostCheckout;

    if (onProgress !== undefined)
      options.onProgress = onProgress;

    if (ref !== undefined)
      options.ref = ref;

    if (relative !== undefined)
      options.relative = relative;

    if (remote !== undefined)
      options.remote = remote;

    if (since !== undefined)
      options.since = since;

    if (singleBranch !== undefined)
      options.singleBranch = singleBranch;

    return await _clone(options);
  } catch(err: unknown) {
    (err as any).caller = "git.clone";
    throw err;
  }
}

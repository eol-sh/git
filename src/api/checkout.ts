/**
 * @fileoverview Git checkout API - High-level user interface
 *
 * This module provides the public API for checkout operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/checkout.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _checkout } from "../commands/checkout.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient, PostCheckoutCallback, ProgressCallback } from "../types.ts";

interface CheckoutOptions {
  batchSize?: number;
  cache?: Cache;
  dir: string;
  dryRun?: boolean;
  filepaths?: string[];
  force?: boolean;
  fs: FsClient;
  gitdir?: string;
  noCheckout?: boolean;
  nonBlocking?: boolean;
  noUpdateHead?: boolean;
  onPostCheckout?: PostCheckoutCallback;
  onProgress?: ProgressCallback;
  ref?: string;
  remote?: string;
  track?: boolean;
}



//// export

/**
 * Checkout a branch
 */
export async function checkout({
  batchSize = 100,
  cache = new Map(),
  dir,
  dryRun = false,
  filepaths,
  force = false,
  fs,
  gitdir = join(dir, ".git"),
  noCheckout = false,
  nonBlocking = false,
  onProgress,
  onPostCheckout,
  ref: _ref,
  noUpdateHead = _ref === undefined,
  remote = "origin",
  track = true
}: CheckoutOptions): Promise<void> {
  try {
    assertParameter("fs", fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const ref = _ref || "HEAD";

    const options: any = {
      cache,
      dir,
      fs,
      gitdir,
      ref
    };

    if (batchSize !== undefined)
      options.batchSize = batchSize;

    if (dryRun !== undefined)
      options.dryRun = dryRun;

    if (filepaths !== undefined)
      options.filepaths = filepaths;

    if (force !== undefined)
      options.force = force;

    if (noCheckout !== undefined)
      options.noCheckout = noCheckout;

    if (nonBlocking !== undefined)
      options.nonBlocking = nonBlocking;

    if (noUpdateHead !== undefined)
      options.noUpdateHead = noUpdateHead;

    if (onProgress !== undefined)
      options.onProgress = onProgress;

    if (onPostCheckout !== undefined)
      options.onPostCheckout = onPostCheckout;

    if (remote !== undefined)
      options.remote = remote;

    if (track !== undefined)
      options.track = track;

    return await _checkout(options);
  } catch(err: unknown) {
    (err as any).caller = "git.checkout";
    throw err;
  }
}

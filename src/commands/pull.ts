


/**
 * @fileoverview Command for fetching and merging changes from remote repositories
 * 
 * This module implements Git's pull operation, which combines fetch and merge
 * operations in a single command. It first downloads objects and references from
 * the remote repository, then integrates those changes into the current branch.
 * The command supports various merge strategies including fast-forward and merge
 * commits, with comprehensive error handling for authentication, network issues,
 * and merge conflicts during the integration process.
 * 
 * @module commands/pull
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { _checkout } from "./checkout.ts";
import { _currentBranch } from "./current-branch.ts";
import { _fetch } from "./fetch.ts";
import { _merge } from "./merge.ts";
import { PullError } from "../errors/pull.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  Author,
  AuthSuccessCallback,
  Cache,
  FsInterface,
  HttpClient,
  MessageCallback,
  ProgressCallback
} from "../types.ts";

interface PullOptions {
  author: Author;
  cache: Cache;
  committer: Author;
  corsProxy?: string;
  dir: string;
  fastForward?: boolean;
  fastForwardOnly?: boolean;
  fs: FsInterface;
  gitdir: string;
  headers?: Record<string, string>;
  http: HttpClient;
  onAuth?: AuthCallback;
  onAuthFailure?: AuthFailureCallback;
  onAuthSuccess?: AuthSuccessCallback;
  onMessage?: MessageCallback;
  onProgress?: ProgressCallback;
  prune?: boolean;
  pruneTags?: boolean;
  ref?: string;
  remote?: string;
  remoteRef?: string;
  signingKey?: string;
  singleBranch?: boolean;
  url?: string;
}



//// export

export async function _pull({
  author,
  cache,
  committer,
  corsProxy,
  dir,
  fastForward,
  fastForwardOnly,
  fs,
  gitdir,
  headers,
  http,
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  onMessage,
  onProgress,
  prune,
  pruneTags,
  ref,
  remote,
  remoteRef,
  signingKey,
  singleBranch,
  url
}: PullOptions): Promise<void> {
  try {
    /*** If ref is undefined, use current branch ***/
    if (!ref) {
      const head = await _currentBranch({ fs, gitdir });

      if (!head) {
        /*** Check if we’re in detached HEAD state or have no current branch ***/
        throw new PullError("no_current_branch");
      }

      ref = head;
    }

    const { fetchHead, fetchHeadDescription } = await _fetch({
      cache,
      ...(corsProxy !== undefined ? { corsProxy } : {}),
      fs,
      gitdir,
      ...(headers !== undefined ? { headers } : {}),
      http,
      ...(onAuth !== undefined ? { onAuth } : {}),
      ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
      ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
      ...(onMessage !== undefined ? { onMessage } : {}),
      ...(onProgress !== undefined ? { onProgress } : {}),
      ...(prune !== undefined ? { prune } : {}),
      ...(pruneTags !== undefined ? { pruneTags } : {}),
      ref,
      ...(remote !== undefined ? { remote } : {}),
      ...(remoteRef !== undefined ? { remoteRef } : {}),
      ...(singleBranch !== undefined ? { singleBranch } : {}),
      ...(url !== undefined ? { url } : {})
    });

    /*** Merge the remote tracking branch into the local one. ***/
    await _merge({
      author,
      cache,
      committer,
      dir,
      dryRun: false,
      ...(fastForward !== undefined ? { fastForward } : {}),
      ...(fastForwardOnly !== undefined ? { fastForwardOnly } : {}),
      fs,
      gitdir,
      message: `Merge ${fetchHeadDescription}`,
      noUpdateBranch: false,
      ours: ref,
      ...(signingKey !== undefined ? { signingKey } : {}),
      theirs: fetchHead!
    });

    await _checkout({
      cache,
      dir,
      fs,
      gitdir,
      noCheckout: false,
      ...(onProgress !== undefined ? { onProgress } : {}),
      ref,
      ...(remote !== undefined ? { remote } : {})
    });
  } catch(err: unknown) {
    (err as any).caller = "git.pull";
    throw err;
  }
}

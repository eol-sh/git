


//// util

import { _pull } from "../commands/pull.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";
import { MissingNameError } from "../errors/missing-name.ts";
import { normalizeAuthorObject } from "../utils/normalize-author-object.ts";
import { normalizeCommitterObject } from "../utils/normalize-committer-object.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  Author,
  AuthSuccessCallback,
  Cache,
  Committer,
  FsInterface,
  HttpClient,
  MessageCallback,
  ProgressCallback
} from "../types.ts";



//// export

/**
 * Options for the pull operation
 */
export interface PullOptions {
  /** The details about the author. */
  author?: Partial<Author>;
  /** a [cache](cache.md) object */
  cache?: Cache;
  /** The details about the commit committer, in the same format as the author parameter. If not specified, the author details are used. */
  committer?: Partial<Committer>;
  /** Optional [CORS proxy](https://www.npmjs.com/%40isomorphic-git/cors-proxy). Overrides value in repo config. */
  corsProxy?: string;
  /** The [working tree](dir-vs-gitdir.md) directory path */
  dir: string;
  /** If false, only create merge commits. */
  fastForward?: boolean;
  /** Only perform simple fast-forward merges. (Don’t create merge commits.) */
  fastForwardOnly?: boolean;
  /** a file system client */
  fs: FsInterface;
  /** [required] The [git directory](dir-vs-gitdir.md) path */
  gitdir?: string;
  /** Additional headers to include in HTTP requests, similar to git’s `extraHeader` config */
  headers?: Record<string, string>;
  /** an HTTP client */
  http: HttpClient;
  /** optional auth fill callback */
  onAuth?: AuthCallback;
  /** optional auth rejected callback */
  onAuthFailure?: AuthFailureCallback;
  /** optional auth approved callback */
  onAuthSuccess?: AuthSuccessCallback;
  /** optional message event callback */
  onMessage?: MessageCallback;
  /** optional progress event callback */
  onProgress?: ProgressCallback;
  /** Delete local remote-tracking branches that are not present on the remote */
  prune?: boolean;
  /** Prune local tags that don’t exist on the remote, and force-update those tags that differ */
  pruneTags?: boolean;
  /** Which branch to merge into. By default this is the currently checked out branch. */
  ref?: string;
  /** (Added in 1.1.0) If URL is not specified, determines which remote to use. */
  remote?: string;
  /** (Added in 1.1.0) The name of the branch on the remote to fetch. By default this is the configured remote tracking branch. */
  remoteRef?: string;
  /** passed to [commit](commit.md) when creating a merge commit */
  signingKey?: string;
  /** Instead of the default behavior of fetching all the branches, only fetch a single branch. */
  singleBranch?: boolean;
  /** (Added in 1.1.0) The URL of the remote repository. The default is the value set in the git config for that remote. */
  url?: string;
}

/**
 * Fetch and merge commits from a remote repository
 *
 * @param args - Options for the pull operation
 * @returns Resolves successfully when pull operation completes
 *
 * @example
 * await git.pull({
 *   dir: "/tutorial",
 *   fs,
 *   http,
 *   ref: "main",
 *   singleBranch: true
 * });
 * console.log("done");
 */
export async function pull({
  author: _author,
  cache = new Map(),
  committer: _committer,
  corsProxy,
  dir,
  fastForward = true,
  fastForwardOnly = false,
  fs: _fs,
  gitdir = join(dir, ".git"),
  headers = {},
  http,
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  onMessage,
  onProgress,
  prune = false,
  pruneTags = false,
  ref,
  remote,
  remoteRef,
  signingKey,
  singleBranch,
  url
}: PullOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);

    const unifiedFs = adaptFsInterface(_fs);

    const author = await normalizeAuthorObject({
      ...(_author ? { author: _author } : {}),
      fs: _fs,
      gitdir
    });

    if (!author)
      throw new MissingNameError("author");

    const committer = await normalizeCommitterObject({
      ...(author ? { author } : {}),
      ...(_committer ? { committer: _committer } : {}),
      fs: _fs,
      gitdir
    });

    if (!committer)
      throw new MissingNameError("committer");

    return await _pull({
      author,
      cache,
      committer,
      ...(corsProxy !== undefined ? { corsProxy } : {}),
      dir,
      fastForward,
      fastForwardOnly,
      fs: unifiedFs,
      gitdir,
      headers,
      http,
      ...(onAuth !== undefined ? { onAuth } : {}),
      ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
      ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
      ...(onMessage !== undefined ? { onMessage } : {}),
      ...(onProgress !== undefined ? { onProgress } : {}),
      prune,
      pruneTags,
      ...(ref !== undefined ? { ref } : {}),
      ...(remote !== undefined ? { remote } : {}),
      ...(remoteRef !== undefined ? { remoteRef } : {}),
      ...(signingKey !== undefined ? { signingKey } : {}),
      ...(singleBranch !== undefined ? { singleBranch } : {}),
      ...(url !== undefined ? { url } : {})
    });
  } catch(err: unknown) {
    (err as any).caller = "git.pull";
    throw err;
  }
}

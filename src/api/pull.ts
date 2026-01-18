/**
 * @fileoverview Git pull API - High-level user interface
 *
 * This module provides the public API for pull operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/pull.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


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
 * Configuration options for pulling changes from a remote repository
 * 
 * @interface PullOptions
 */
export interface PullOptions {
  /** Author details for merge commits (defaults to git config values) */
  author?: Partial<Author>;
  /** Cache for performance optimization */
  cache?: Cache;
  /** Committer details for merge commits (defaults to author if not specified) */
  committer?: Partial<Committer>;
  /** CORS proxy URL for browser environments - overrides repo config */
  corsProxy?: string;
  /** Working directory path (required) */
  dir: string;
  /** Allow fast-forward merges when possible (defaults to true) */
  fastForward?: boolean;
  /** Only perform fast-forward merges, fail if merge commit needed */
  fastForwardOnly?: boolean;
  /** File system implementation (required) */
  fs: FsInterface;
  /** Git directory path (defaults to `${dir}/.git`) */
  gitdir?: string;
  /** Additional HTTP headers for requests (similar to git's `extraHeader` config) */
  headers?: Record<string, string>;
  /** HTTP client implementation for network operations (required) */
  http: HttpClient;
  /** Authentication callback for credentials */
  onAuth?: AuthCallback;
  /** Callback fired when authentication fails */
  onAuthFailure?: AuthFailureCallback;
  /** Callback fired when authentication succeeds */
  onAuthSuccess?: AuthSuccessCallback;
  /** Callback for processing remote messages during fetch */
  onMessage?: MessageCallback;
  /** Progress callback for tracking fetch and merge operations */
  onProgress?: ProgressCallback;
  /** Delete local remote-tracking branches not present on remote */
  prune?: boolean;
  /** Prune local tags that don't exist remotely and force-update differing tags */
  pruneTags?: boolean;
  /** Branch to merge into (defaults to currently checked out branch) */
  ref?: string;
  /** Remote name to pull from (defaults to configured tracking remote) */
  remote?: string;
  /** Remote branch name to fetch (defaults to configured tracking branch) */
  remoteRef?: string;
  /** GPG signing key for merge commits */
  signingKey?: string;
  /** Fetch only a single branch instead of all branches */
  singleBranch?: boolean;
  /** URL of remote repository (overrides configured remote URL) */
  url?: string;
}

/**
 * Fetch and merge commits from a remote repository
 * 
 * Combines the functionality of `git fetch` and `git merge` in a single operation.
 * Downloads new commits from a remote repository and automatically merges them
 * into the current branch. This is the most common way to update a local repository
 * with changes from collaborators.
 *
 * @param {Object} options - Pull configuration options
 * @param {Partial<Author>} [options.author] - Author details for merge commits
 * @param {Cache} [options.cache] - Cache for performance optimization
 * @param {Partial<Committer>} [options.committer] - Committer details for merge commits
 * @param {string} [options.corsProxy] - CORS proxy URL for browser environments
 * @param {string} options.dir - Working directory path (required)
 * @param {boolean} [options.fastForward=true] - Allow fast-forward merges when possible
 * @param {boolean} [options.fastForwardOnly=false] - Only fast-forward, fail if merge needed
 * @param {FsInterface} options.fs - File system implementation (required)
 * @param {string} [options.gitdir] - Git directory path (defaults to `${dir}/.git`)
 * @param {Object} [options.headers={}] - Additional HTTP headers for requests
 * @param {HttpClient} options.http - HTTP client implementation (required)
 * @param {AuthCallback} [options.onAuth] - Authentication callback for credentials
 * @param {AuthFailureCallback} [options.onAuthFailure] - Called when authentication fails
 * @param {AuthSuccessCallback} [options.onAuthSuccess] - Called when authentication succeeds
 * @param {MessageCallback} [options.onMessage] - Processes remote messages during fetch
 * @param {ProgressCallback} [options.onProgress] - Progress tracking callback
 * @param {boolean} [options.prune=false] - Delete local remote-tracking branches not on remote
 * @param {boolean} [options.pruneTags=false] - Prune local tags not on remote
 * @param {string} [options.ref] - Branch to merge into (defaults to current branch)
 * @param {string} [options.remote] - Remote name to pull from
 * @param {string} [options.remoteRef] - Remote branch name to fetch
 * @param {string} [options.signingKey] - GPG signing key for merge commits
 * @param {boolean} [options.singleBranch] - Fetch only a single branch
 * @param {string} [options.url] - Remote repository URL (overrides config)
 * 
 * @returns {Promise<void>} Resolves when pull operation completes successfully
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {Error} When network operations fail
 * @throws {Error} When authentication fails
 * @throws {Error} When merge conflicts occur that can't be auto-resolved
 * @throws {Error} When fast-forward only is enabled but merge commit is needed
 * @throws {MissingNameError} When author or committer name is missing for merge commits
 * 
 * @example
 * ```typescript
 * import { pull } from '@eol/git'
 * import fs from 'fs'
 * import http from 'http'
 * 
 * // Basic pull from default remote/branch
 * await pull({
 *   fs,
 *   http,
 *   dir: '/path/to/repo'
 * })
 * 
 * // Pull specific branch with authentication
 * await pull({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   ref: 'main',
 *   remote: 'upstream',
 *   onAuth: () => ({
 *     username: 'token',
 *     password: process.env.GITHUB_TOKEN
 *   })
 * })
 * 
 * // Pull with custom author for merge commits
 * await pull({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   author: {
 *     name: 'Your Name',
 *     email: 'you@example.com'
 *   }
 * })
 * 
 * // Fast-forward only pull (no merge commits)
 * await pull({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   fastForwardOnly: true
 * })
 * 
 * // Pull with branch pruning
 * await pull({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   prune: true,
 *   pruneTags: true
 * })
 * 
 * // Pull single branch only
 * await pull({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   remoteRef: 'feature-branch',
 *   singleBranch: true
 * })
 * 
 * // Pull with progress tracking
 * await pull({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   onProgress: (progress) => {
 *     console.log(`${progress.phase}: ${progress.loaded}/${progress.total}`)
 *   }
 * })
 * 
 * // Handle merge conflicts
 * try {
 *   await pull({ fs, http, dir: '/path/to/repo' })
 * } catch (error) {
 *   if (error.code === 'MergeConflictError') {
 *     console.log('Merge conflicts detected, manual resolution required')
 *     // Handle conflicts...
 *   }
 * }
 * ```
 * 
 * @see {@link https://git-scm.com/docs/git-pull} Git pull documentation
 * @since 1.0.0
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

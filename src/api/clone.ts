/**
 * @fileoverview Git clone API - High-level user interface
 *
 * This module provides the public API for clone operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/clone.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


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

/**
 * Configuration options for cloning a Git repository
 * 
 * @interface CloneOptions
 */
interface CloneOptions {
  /** Number of objects to fetch at once (defaults to 100) */
  batchSize?: number;
  /** Cache for performance optimization */
  cache?: Cache;
  /** CORS proxy URL for browser environments */
  corsProxy?: string;
  /** Create shallow clone with specified depth (number of commits) */
  depth?: number;
  /** Working directory path where repository will be cloned */
  dir: string;
  /** List of ref patterns to exclude from clone */
  exclude?: string[];
  /** File system implementation (required) */
  fs: FsClient;
  /** Git directory path (defaults to `${dir}/.git`) */
  gitdir?: string;
  /** Additional HTTP headers for requests */
  headers?: Record<string, string>;
  /** HTTP client implementation for network operations (required) */
  http: HttpClient;
  /** Skip checkout of working directory files */
  noCheckout?: boolean;
  /** Allow clone operation to return before completion */
  nonBlocking?: boolean;
  /** Do not fetch tags */
  noTags?: boolean;
  /** Authentication callback for credentials */
  onAuth?: AuthCallback;
  /** Callback fired on authentication failure */
  onAuthFailure?: AuthFailureCallback;
  /** Callback fired on authentication success */
  onAuthSuccess?: AuthSuccessCallback;
  /** Callback for processing remote messages */
  onMessage?: MessageCallback;
  /** Callback fired after checkout completion */
  onPostCheckout?: PostCheckoutCallback;
  /** Progress callback for clone operations */
  onProgress?: ProgressCallback;
  /** Specific ref to clone (branch, tag, or commit) */
  ref?: string;
  /** Use relative URLs in submodule .gitmodules */
  relative?: boolean;
  /** Name of remote (defaults to "origin") */
  remote?: string;
  /** Only clone commits newer than this date */
  since?: Date;
  /** Clone only a single branch */
  singleBranch?: boolean;
  /** Repository URL to clone from (required) */
  url: string;
}



//// export

/**
 * Clone a Git repository from a remote URL
 * 
 * Creates a complete copy of a remote repository, including all history, branches,
 * and tags. This is equivalent to the `git clone` command and is typically the
 * first operation when starting work on an existing project.
 *
 * @param {Object} options - Clone configuration options
 * @param {number} [options.batchSize=100] - Number of objects to fetch at once for performance
 * @param {Cache} [options.cache] - Cache for performance optimization
 * @param {string} [options.corsProxy] - CORS proxy URL for browser environments
 * @param {number} [options.depth] - Create shallow clone with specified depth (number of commits)
 * @param {string} options.dir - Working directory path where repository will be cloned
 * @param {string[]} [options.exclude=[]] - List of ref patterns to exclude from clone
 * @param {FsClient} options.fs - File system implementation (required)
 * @param {string} [options.gitdir] - Git directory path (defaults to `${dir}/.git`)
 * @param {Object} [options.headers={}] - Additional HTTP headers for requests
 * @param {HttpClient} options.http - HTTP client implementation for network operations (required)
 * @param {boolean} [options.noCheckout=false] - Skip checkout of working directory files
 * @param {boolean} [options.nonBlocking=false] - Allow clone operation to return before completion
 * @param {boolean} [options.noTags=false] - Do not fetch tags
 * @param {AuthCallback} [options.onAuth] - Authentication callback for credentials
 * @param {AuthFailureCallback} [options.onAuthFailure] - Callback fired on authentication failure
 * @param {AuthSuccessCallback} [options.onAuthSuccess] - Callback fired on authentication success
 * @param {MessageCallback} [options.onMessage] - Callback for processing remote messages
 * @param {PostCheckoutCallback} [options.onPostCheckout] - Callback fired after checkout completion
 * @param {ProgressCallback} [options.onProgress] - Progress callback for clone operations
 * @param {string} [options.ref] - Specific ref to clone (branch, tag, or commit)
 * @param {boolean} [options.relative=false] - Use relative URLs in submodule .gitmodules
 * @param {string} [options.remote="origin"] - Name of remote (defaults to "origin")
 * @param {Date} [options.since] - Only clone commits newer than this date
 * @param {boolean} [options.singleBranch=false] - Clone only a single branch
 * @param {string} options.url - Repository URL to clone from (required)
 * 
 * @returns {Promise<void>} Resolves when clone operation completes successfully
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {Error} When network operations fail
 * @throws {Error} When authentication fails
 * @throws {Error} When file system operations fail
 * @throws {Error} When repository URL is invalid or inaccessible
 * 
 * @example
 * ```typescript
 * import { clone } from '@eol/git'
 * import fs from 'fs'
 * import http from 'http'
 * 
 * // Basic clone operation
 * await clone({
 *   fs,
 *   http,
 *   dir: '/path/to/local/repo',
 *   url: 'https://github.com/user/repo.git'
 * })
 * 
 * // Clone with shallow depth
 * await clone({
 *   fs,
 *   http,
 *   dir: '/path/to/shallow/repo',
 *   url: 'https://github.com/user/repo.git',
 *   depth: 1
 * })
 * 
 * // Clone specific branch only
 * await clone({
 *   fs,
 *   http,
 *   dir: '/path/to/feature/repo',
 *   url: 'https://github.com/user/repo.git',
 *   ref: 'feature-branch',
 *   singleBranch: true
 * })
 * 
 * // Clone with authentication
 * await clone({
 *   fs,
 *   http,
 *   dir: '/path/to/private/repo',
 *   url: 'https://github.com/user/private-repo.git',
 *   onAuth: () => ({ username: 'token', password: 'github_token' })
 * })
 * 
 * // Clone without checking out files (bare-like)
 * await clone({
 *   fs,
 *   http,
 *   dir: '/path/to/bare/repo',
 *   url: 'https://github.com/user/repo.git',
 *   noCheckout: true
 * })
 * 
 * // Clone with progress tracking
 * await clone({
 *   fs,
 *   http,
 *   dir: '/path/to/tracked/repo',
 *   url: 'https://github.com/user/large-repo.git',
 *   onProgress: (progress) => {
 *     console.log(`Progress: ${progress.phase} - ${progress.loaded}/${progress.total}`)
 *   }
 * })
 * ```
 * 
 * @see {@link https://git-scm.com/docs/git-clone} Git clone documentation
 * @since 1.0.0
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

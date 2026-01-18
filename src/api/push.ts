/**
 * @fileoverview Git push API - High-level user interface
 *
 * This module provides the public API for push operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/push.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _push } from "../commands/push.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
  Cache,
  FsClient,
  HttpClient,
  MessageCallback,
  PrePushCallback,
  ProgressCallback,
  PushResult
} from "../types.ts";



//// export

/**
 * Configuration options for pushing changes to a remote repository
 * 
 * @interface PushOptions
 */
export interface PushOptions {
  /** Cache for performance optimization */
  cache?: Cache;
  /** CORS proxy URL for browser environments - overrides repo config */
  corsProxy?: string;
  /** Delete the remote ref instead of pushing (equivalent to `git push --delete`) */
  delete?: boolean;
  /** Working directory path - used for resolving refs if gitdir is not specified */
  dir?: string;
  /** Force push even if it would result in non-fast-forward update (`git push --force`) */
  force?: boolean;
  /** File system implementation (required) */
  fs: FsClient;
  /** Git directory path (defaults to `${dir}/.git` if dir is specified) */
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
  /** Callback for processing remote messages during push */
  onMessage?: MessageCallback;
  /** Pre-push hook callback - can cancel push by returning false */
  onPrePush?: PrePushCallback;
  /** Progress callback for tracking push operations */
  onProgress?: ProgressCallback;
  /** Branch or tag to push (defaults to currently checked out branch) */
  ref?: string;
  /** Remote name to push to (defaults to "origin") */
  remote?: string;
  /** Name of receiving branch on remote (defaults to configured tracking branch) */
  remoteRef?: string;
  /** URL of remote repository (overrides configured remote URL) */
  url?: string;
}

/**
 * Push local commits to a remote repository
 * 
 * Uploads local commits, branches, and tags to a remote repository, updating the
 * remote refs to match the local state. This is equivalent to the `git push` command
 * and is essential for sharing changes with other developers.
 *
 * @param {Object} options - Push configuration options
 * @param {Cache} [options.cache] - Cache for performance optimization
 * @param {string} [options.corsProxy] - CORS proxy URL for browser environments
 * @param {boolean} [options.delete=false] - Delete remote ref instead of pushing
 * @param {string} [options.dir] - Working directory path for ref resolution
 * @param {boolean} [options.force=false] - Force push even if non-fast-forward
 * @param {FsClient} options.fs - File system implementation (required)
 * @param {string} [options.gitdir] - Git directory path (auto-derived if not specified)
 * @param {Object} [options.headers={}] - Additional HTTP headers for requests
 * @param {HttpClient} options.http - HTTP client implementation (required)
 * @param {AuthCallback} [options.onAuth] - Authentication callback for credentials
 * @param {AuthFailureCallback} [options.onAuthFailure] - Called when authentication fails
 * @param {AuthSuccessCallback} [options.onAuthSuccess] - Called when authentication succeeds
 * @param {MessageCallback} [options.onMessage] - Processes remote server messages
 * @param {PrePushCallback} [options.onPrePush] - Pre-push hook (can cancel operation)
 * @param {ProgressCallback} [options.onProgress] - Progress tracking callback
 * @param {string} [options.ref] - Branch or tag to push (defaults to current branch)
 * @param {string} [options.remote="origin"] - Remote name to push to
 * @param {string} [options.remoteRef] - Remote branch name (defaults to tracking branch)
 * @param {string} [options.url] - Remote repository URL (overrides config)
 * 
 * @returns {Promise<PushResult>} Detailed result of push operation from server
 * 
 * **Result Structure:**
 * - `ok: string[]` - Successful operations. First item is "unpack" if overall success, followed by updated ref names
 * - `errors?: string[]` - Failed operations. First item format: "unpack {error}", others: "{ref} {error}"
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {Error} When network operations fail
 * @throws {Error} When authentication fails
 * @throws {Error} When push is rejected (non-fast-forward without force)
 * @throws {Error} When remote repository is not accessible
 * 
 * @example
 * ```typescript
 * import { push } from '@eol/git'
 * import fs from 'fs'
 * import http from 'http'
 * 
 * // Basic push to origin/main
 * const result = await push({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   ref: 'main',
 *   remote: 'origin'
 * })
 * console.log('Push result:', result.ok)
 * 
 * // Push with authentication
 * const authResult = await push({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   onAuth: () => ({
 *     username: 'token',
 *     password: process.env.GITHUB_TOKEN
 *   })
 * })
 * 
 * // Force push (dangerous!)
 * const forceResult = await push({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   force: true,
 *   onPrePush: (pushInfo) => {
 *     console.warn('Force pushing, this may overwrite remote changes!')
 *     return true // Proceed with force push
 *   }
 * })
 * 
 * // Push to different remote branch
 * await push({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   ref: 'feature-branch',
 *   remote: 'upstream',
 *   remoteRef: 'main'
 * })
 * 
 * // Delete remote branch
 * await push({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   ref: 'feature-branch',
 *   delete: true
 * })
 * 
 * // Push with progress tracking
 * await push({
 *   fs,
 *   http,
 *   dir: '/path/to/repo',
 *   onProgress: (progress) => {
 *     console.log(`${progress.phase}: ${progress.loaded}/${progress.total}`)
 *   }
 * })
 * 
 * // Handle push failures
 * try {
 *   await push({ fs, http, dir: '/path/to/repo' })
 * } catch (error) {
 *   if (error.code === 'PushRejectedError') {
 *     console.log('Push rejected, try pulling first')
 *   }
 * }
 * ```
 * 
 * @see {@link https://git-scm.com/docs/git-push} Git push documentation
 * @since 1.0.0
 */
export async function push({
  cache = new Map(),
  corsProxy,
  delete: _delete = false,
  dir,
  force = false,
  fs,
  gitdir = join(dir!, ".git"),
  headers = {},
  http,
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  onMessage,
  onPrePush,
  onProgress,
  ref,
  remote = "origin",
  remoteRef,
  url
}: PushOptions): Promise<PushResult> {
  try {
    assertParameter("fs", fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);

    return await _push({
      cache,
      ...(corsProxy !== undefined ? { corsProxy } : {}),
      delete: _delete,
      force,
      fs: adaptFsInterface(fs),
      gitdir,
      headers,
      http,
      ...(onAuth !== undefined ? { onAuth } : {}),
      ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
      ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
      ...(onMessage !== undefined ? { onMessage } : {}),
      ...(onPrePush !== undefined ? { onPrePush } : {}),
      ...(onProgress !== undefined ? { onProgress } : {}),
      ...(ref !== undefined ? { ref } : {}),
      remote,
      ...(remoteRef !== undefined ? { remoteRef } : {}),
      ...(url !== undefined ? { url } : {})
    });
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.push";
    throw error;
  }
}

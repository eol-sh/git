

/**
 * @fileoverview Git commit API - Creates commits from staged changes
 * 
 * This module provides the high-level API for creating Git commits. It wraps
 * the lower-level commit command and handles parameter validation, file system
 * adaptation, and error handling.
 * 
 * @module api/commit
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { _commit } from "../commands/commit.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Author, Cache, Committer, FsClient, SignCallback } from "../types.ts";

/**
 * Configuration options for creating a commit
 * 
 * @interface CommitOptions
 */
interface CommitOptions {
  /** Amend the previous commit instead of creating a new one */
  amend?: boolean;
  /** Author information including name, email, and timestamp */
  author?: Author;
  /** Cache for performance optimization */
  cache?: Cache;
  /** Committer information including name, email, and timestamp */
  committer?: Committer;
  /** Working directory path */
  dir?: string;
  /** Preview changes without actually committing */
  dryRun?: boolean;
  /** File system implementation (required) */
  fs: FsClient;
  /** Git directory path (defaults to `${dir}/.git`) */
  gitdir?: string;
  /** Commit message (required unless amending) */
  message?: string;
  /** Create commit object but don't update branch reference */
  noUpdateBranch?: boolean;
  /** Function to sign commits (required if signingKey provided) */
  onSign?: SignCallback;
  /** Parent commit OIDs (for merge commits) */
  parent?: string[];
  /** Reference to update (defaults to current HEAD) */
  ref?: string;
  /** GPG signing key identifier */
  signingKey?: string;
  /** Tree OID to use (defaults to current index) */
  tree?: string;
}



//// export

/**
 * Create a new commit in a Git repository
 * 
 * Creates a commit object from the current index (staging area) and updates the 
 * specified reference (usually HEAD). This is one of the core Git operations that 
 * records changes to the repository history.
 *
 * @param {Object} options - Commit configuration options
 * @param {boolean} [options.amend=false] - Amend the previous commit instead of creating a new one
 * @param {Author} [options.author] - Author information (name, email, timestamp, timezone)
 * @param {Cache} [options.cache] - Cache for performance optimization
 * @param {Committer} [options.committer] - Committer information (name, email, timestamp, timezone) 
 * @param {string} [options.dir] - Working directory path
 * @param {boolean} [options.dryRun=false] - Preview changes without actually committing
 * @param {FsClient} options.fs - File system implementation (required)
 * @param {string} [options.gitdir] - Git directory path (defaults to `${dir}/.git`)
 * @param {string} [options.message] - Commit message (required unless amending)
 * @param {boolean} [options.noUpdateBranch=false] - Create commit object but don't update branch reference
 * @param {SignCallback} [options.onSign] - Function to sign commits (required if signingKey provided)
 * @param {string[]} [options.parent] - Parent commit OIDs (for merge commits)
 * @param {string} [options.ref] - Reference to update (defaults to current HEAD)
 * @param {string} [options.signingKey] - GPG signing key identifier
 * @param {string} [options.tree] - Tree OID to use (defaults to current index)
 * 
 * @returns {Promise<string>} The OID (SHA-1 hash) of the created commit
 * 
 * @throws {Error} When required parameters are missing or invalid
 * @throws {Error} When file system operations fail  
 * @throws {Error} When Git repository is not properly initialized
 * 
 * @example
 * ```typescript
 * import { commit } from '@eol/git'
 * import fs from 'fs'
 * 
 * // Basic commit
 * const sha = await commit({
 *   fs,
 *   dir: '/path/to/repo',
 *   message: 'Add new feature',
 *   author: {
 *     name: 'John Doe',
 *     email: 'john@example.com',
 *     timestamp: Math.floor(Date.now() / 1000),
 *     timezoneOffset: new Date().getTimezoneOffset()
 *   }
 * })
 * console.log('Commit created:', sha)
 * 
 * // Amend previous commit
 * await commit({
 *   fs,
 *   dir: '/path/to/repo', 
 *   message: 'Updated commit message',
 *   amend: true
 * })
 * 
 * // Dry run to preview
 * const previewSha = await commit({
 *   fs,
 *   dir: '/path/to/repo',
 *   message: 'Test commit',
 *   dryRun: true
 * })
 * ```
 * 
 * @see {@link https://git-scm.com/docs/git-commit} Git commit documentation
 * @since 1.0.0
 */
export async function commit({
  amend = false,
  author,
  cache = new Map(),
  committer,
  dir,
  dryRun = false,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  message,
  noUpdateBranch = false,
  onSign,
  parent,
  ref,
  signingKey,
  tree
}: CommitOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);

    if (!amend)
      assertParameter("message", message);

    if (signingKey)
      assertParameter("onSign", onSign);

    const fs = adaptFileSystem(new FileSystem(_fs));

    const options: any = {
      cache,
      fs,
      gitdir,
      message
    };

    if (amend !== undefined)
      options.amend = amend;

    if (author !== undefined)
      options.author = author;

    if (committer !== undefined)
      options.committer = committer;

    if (dryRun !== undefined)
      options.dryRun = dryRun;

    if (noUpdateBranch !== undefined)
      options.noUpdateBranch = noUpdateBranch;

    if (onSign !== undefined)
      options.onSign = onSign;

    if (parent !== undefined)
      options.parent = parent;

    if (ref !== undefined)
      options.ref = ref;

    if (signingKey !== undefined)
      options.signingKey = signingKey;

    if (tree !== undefined)
      options.tree = tree;

    return await _commit(options);
  } catch(err: unknown) {
    (err as any).caller = "git.commit";
    throw err;
  }
}

/**
 * @fileoverview Git cherry-pick API - High-level user interface
 *
 * This module provides the public API for cherry-pick operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/cherry-pick.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
 * Git cherry-pick API - Apply the changes introduced by some existing commits
 */

import { _cherryPick } from "../commands/cherry-pick.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface CherryPickOptions {
  cache?: Cache;
  dir: string;
  fs: FsClient;
  gitdir?: string;
  oid: string;
  noCommit?: boolean;
  mainline?: number;
  message?: string;
  author?: {
    name: string;
    email: string;
    timestamp?: number;
    timezoneOffset?: number;
  };
  committer?: {
    name: string;
    email: string;
    timestamp?: number;
    timezoneOffset?: number;
  };
}

/**
 * Apply the changes introduced by an existing commit
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} args.oid - The commit OID to cherry-pick
 * @param {boolean} [args.noCommit=false] - Apply changes but don't create a commit
 * @param {number} [args.mainline] - Parent number for merge commits (1-based)
 * @param {string} [args.message] - Custom commit message (default: original message + cherry-pick note)
 * @param {Object} [args.author] - Override commit author
 * @param {Object} [args.committer] - Override committer
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<string|null>} The OID of the new commit, or null if --no-commit or conflicts
 * 
 * @example
 * // Cherry-pick a specific commit
 * const newOid = await git.cherryPick({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'abc123...'
 * })
 * console.log('Cherry-picked as:', newOid)
 * 
 * @example
 * // Cherry-pick without committing
 * await git.cherryPick({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'abc123...',
 *   noCommit: true
 * })
 * 
 * @example
 * // Cherry-pick a merge commit (specify parent)
 * const newOid = await git.cherryPick({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'merge123...',
 *   mainline: 1  // Use first parent
 * })
 * 
 * @example
 * // Cherry-pick with custom message
 * const newOid = await git.cherryPick({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'abc123...',
 *   message: 'Backport: Fix critical bug'
 * })
 */
export async function cherryPick({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  oid,
  noCommit = false,
  mainline,
  message,
  author,
  committer
}: CherryPickOptions): Promise<string | null> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    const fileSystem = new FileSystem(_fs);

    return await _cherryPick({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      oid,
      noCommit,
      mainline,
      message,
      author,
      committer
    });
  } catch (err: unknown) {
    (err as any).caller = "git.cherryPick";
    throw err;
  }
}
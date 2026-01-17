/**
 * Git revert API - Revert some existing commits
 */

import { _revert } from "../commands/revert.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface RevertOptions {
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
 * Create a commit that undoes the changes from a previous commit
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} args.oid - The commit OID to revert
 * @param {boolean} [args.noCommit=false] - Apply changes but don't create a commit
 * @param {number} [args.mainline] - Parent number for merge commits (1-based)
 * @param {string} [args.message] - Custom commit message (default: auto-generated revert message)
 * @param {Object} [args.author] - Override commit author
 * @param {Object} [args.committer] - Override committer
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<string|null>} The OID of the new commit, or null if --no-commit or conflicts
 * 
 * @example
 * // Revert a specific commit
 * const revertOid = await git.revert({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'abc123...'
 * })
 * console.log('Created revert commit:', revertOid)
 * 
 * @example
 * // Revert without committing
 * await git.revert({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'abc123...',
 *   noCommit: true
 * })
 * // Changes are staged, ready for manual commit
 * 
 * @example
 * // Revert a merge commit (specify parent)
 * const revertOid = await git.revert({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'merge123...',
 *   mainline: 1  // Revert relative to first parent
 * })
 * 
 * @example
 * // Revert with custom message
 * const revertOid = await git.revert({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'abc123...',
 *   message: 'Undo breaking change from release'
 * })
 */
export async function revert({
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
}: RevertOptions): Promise<string | null> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    const fileSystem = new FileSystem(_fs);

    return await _revert({
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
    (err as any).caller = "git.revert";
    throw err;
  }
}
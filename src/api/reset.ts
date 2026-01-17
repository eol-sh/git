/**
 * Git reset API - Reset current HEAD to the specified state
 */

import { _reset, ResetMode } from "../commands/reset.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface ResetOptions {
  cache?: Cache;
  dir: string;
  fs: FsClient;
  gitdir?: string;
  mode?: ResetMode;
  ref?: string;
  filepath?: string | string[];
}

/**
 * Reset current HEAD to the specified state
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.mode="mixed"] - Reset mode: "soft", "mixed", or "hard"
 * @param {string} [args.ref="HEAD~1"] - The commit/ref to reset to
 * @param {string | string[]} [args.filepath] - Specific file(s) to reset (always uses mixed mode)
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<void>}
 * 
 * @example
 * // Soft reset - only move HEAD
 * await git.reset({
 *   fs,
 *   dir: '/path/to/repo',
 *   mode: 'soft',
 *   ref: 'HEAD~1'
 * })
 * 
 * @example
 * // Mixed reset (default) - move HEAD and reset index
 * await git.reset({
 *   fs,
 *   dir: '/path/to/repo',
 *   ref: 'HEAD~2'
 * })
 * 
 * @example
 * // Hard reset - move HEAD, reset index AND working tree
 * await git.reset({
 *   fs,
 *   dir: '/path/to/repo',
 *   mode: 'hard',
 *   ref: 'origin/main'
 * })
 * 
 * @example
 * // Reset specific files in index
 * await git.reset({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: ['src/file1.js', 'src/file2.js'],
 *   ref: 'HEAD'
 * })
 */
export async function reset({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  mode = "mixed",
  ref = "HEAD~1",
  filepath
}: ResetOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    
    // Validate mode
    if (!["soft", "mixed", "hard"].includes(mode)) {
      throw new Error(`Invalid reset mode: ${mode}. Must be "soft", "mixed", or "hard"`);
    }
    
    // If filepath is specified, mode must be mixed
    if (filepath && mode !== "mixed") {
      throw new Error("Cannot specify files with soft or hard reset mode");
    }

    const fileSystem = new FileSystem(_fs);

    await _reset({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      mode,
      ref,
      filepath
    });
  } catch (err: unknown) {
    (err as any).caller = "git.reset";
    throw err;
  }
}
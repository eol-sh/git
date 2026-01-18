/**
 * @fileoverview Git rebase API - High-level user interface
 *
 * This module provides the public API for rebase operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/rebase.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
 * Git rebase API - Reapply commits on top of another base tip
 */

import { _rebase, _rebaseContinue, _rebaseAbort, _rebaseSkip } from "../commands/rebase.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { RebaseResult, RebaseAction } from "../models/rebase-state.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface RebaseOptions {
  cache?: Cache;
  dir: string;
  fs: FsClient;
  gitdir?: string;
  onto?: string;
  upstream?: string;
  branch?: string;
  interactive?: boolean;
  autosquash?: boolean;
  action?: RebaseAction;
  onEdit?: (todoList: string) => Promise<string>;
}

/**
 * Reapply commits on top of another base tip
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.onto] - The commit to rebase onto
 * @param {string} [args.upstream] - The upstream branch
 * @param {string} [args.branch] - The branch to rebase (default: current branch)
 * @param {boolean} [args.interactive=false] - Use interactive rebase
 * @param {boolean} [args.autosquash=false] - Automatically squash fixup! and squash! commits
 * @param {string} [args.action] - Rebase action: "continue", "abort", or "skip"
 * @param {Function} [args.onEdit] - Callback for editing todo list in interactive mode
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<RebaseResult>} The rebase result
 * 
 * @example
 * // Basic rebase onto main
 * const result = await git.rebase({
 *   fs,
 *   dir: '/path/to/repo',
 *   onto: 'main'
 * })
 * 
 * @example
 * // Interactive rebase with custom todo editing
 * const result = await git.rebase({
 *   fs,
 *   dir: '/path/to/repo',
 *   upstream: 'main',
 *   interactive: true,
 *   onEdit: async (todoList) => {
 *     // Allow user to edit the todo list
 *     return editedTodoList;
 *   }
 * })
 * 
 * @example
 * // Continue rebase after resolving conflicts
 * const result = await git.rebase({
 *   fs,
 *   dir: '/path/to/repo',
 *   action: 'continue'
 * })
 * 
 * @example
 * // Abort rebase
 * const result = await git.rebase({
 *   fs,
 *   dir: '/path/to/repo',
 *   action: 'abort'
 * })
 * 
 * @example
 * // Autosquash rebase
 * const result = await git.rebase({
 *   fs,
 *   dir: '/path/to/repo',
 *   onto: 'main',
 *   autosquash: true
 * })
 */
export async function rebase({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  onto,
  upstream,
  branch,
  interactive = false,
  autosquash = false,
  action,
  onEdit
}: RebaseOptions): Promise<RebaseResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fileSystem = new FileSystem(_fs);

    // Handle rebase actions
    switch (action) {
      case "continue":
        return await _rebaseContinue({
          cache,
          dir,
          fs: fileSystem,
          gitdir
        });
        
      case "abort":
        return await _rebaseAbort({
          cache,
          dir,
          fs: fileSystem,
          gitdir
        });
        
      case "skip":
        return await _rebaseSkip({
          cache,
          dir,
          fs: fileSystem,
          gitdir
        });
        
      default:
        // Start new rebase
        return await _rebase({
          cache,
          dir,
          fs: fileSystem,
          gitdir,
          options: {
            onto,
            upstream,
            branch,
            interactive,
            autosquash,
            onEdit
          }
        });
    }
  } catch (err: unknown) {
    (err as any).caller = "git.rebase";
    throw err;
  }
}
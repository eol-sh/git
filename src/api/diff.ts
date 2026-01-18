/**
 * @fileoverview Git diff API - High-level user interface
 *
 * This module provides the public API for diff operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/diff.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
 * Git diff API - Show changes between commits, commit and working tree, etc.
 */

import { _diff } from "../commands/diff.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { DiffOptions, DiffResult } from "../models/git-diff.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface DiffApiOptions {
  cache?: Cache;
  dir: string;
  fs: FsClient;
  gitdir?: string;
  ref1?: string;
  ref2?: string;
  filepath?: string | string[];
  unified?: number;
  ignoreWhitespace?: boolean;
  ignoreWhitespaceAtEol?: boolean;
  ignoreBlankLines?: boolean;
  binary?: boolean;
  nameOnly?: boolean;
  nameStatus?: boolean;
  raw?: boolean;
}

/**
 * Show changes between commits, commit and working tree, etc.
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.ref1="HEAD"] - First ref to compare (default: HEAD)
 * @param {string} [args.ref2] - Second ref to compare (if not provided, compares with working tree)
 * @param {string | string[]} [args.filepath] - Limit diff to specific file(s)
 * @param {number} [args.unified=3] - Number of context lines
 * @param {boolean} [args.ignoreWhitespace=false] - Ignore whitespace changes
 * @param {boolean} [args.nameOnly=false] - Only show file names
 * @param {boolean} [args.nameStatus=false] - Show file names and status
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<DiffResult>} The diff result
 * 
 * @example
 * // Compare HEAD with working tree
 * const diff = await git.diff({ fs, dir: '/path/to/repo' })
 * 
 * @example
 * // Compare two commits
 * const diff = await git.diff({
 *   fs,
 *   dir: '/path/to/repo',
 *   ref1: 'HEAD~2',
 *   ref2: 'HEAD'
 * })
 * 
 * @example
 * // Show only changed file names
 * const diff = await git.diff({
 *   fs,
 *   dir: '/path/to/repo',
 *   nameOnly: true
 * })
 */
export async function diff({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  ref1 = "HEAD",
  ref2,
  filepath,
  unified = 3,
  ignoreWhitespace = false,
  ignoreWhitespaceAtEol = false,
  ignoreBlankLines = false,
  binary = false,
  nameOnly = false,
  nameStatus = false,
  raw = false
}: DiffApiOptions): Promise<DiffResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fileSystem = new FileSystem(_fs);
    
    const options: DiffOptions = {
      unified,
      ignoreWhitespace,
      ignoreWhitespaceAtEol,
      ignoreBlankLines,
      binary,
      nameOnly,
      nameStatus,
      raw
    };

    return await _diff({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      ref1,
      ref2,
      filepath,
      options
    });
  } catch (err: unknown) {
    (err as any).caller = "git.diff";
    throw err;
  }
}
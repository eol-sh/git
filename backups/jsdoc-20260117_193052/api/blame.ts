/**
 * Git blame API - Show what revision and author last modified each line of a file
 */

import { _blame } from "../commands/blame.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { BlameResult, BlameOptions } from "../models/git-blame.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface BlameApiOptions {
  cache?: Cache;
  dir: string;
  fs: FsClient;
  gitdir?: string;
  ref?: string;
  filepath: string;
  startLine?: number;
  endLine?: number;
  reverse?: boolean;
  firstParent?: boolean;
}

/**
 * Show what revision and author last modified each line of a file
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.ref="HEAD"] - The ref to blame from
 * @param {string} args.filepath - The file to blame
 * @param {number} [args.startLine] - Start line number (1-based)
 * @param {number} [args.endLine] - End line number (1-based)
 * @param {boolean} [args.reverse=false] - Reverse the order of lines
 * @param {boolean} [args.firstParent=false] - Follow only first parent in merge commits
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<BlameResult>} The blame information for each line
 * 
 * @example
 * // Blame entire file
 * const blame = await git.blame({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: 'src/index.js'
 * })
 * 
 * for (const line of blame.lines) {
 *   console.log(`${line.oid.slice(0, 7)} (${line.author} ${new Date(line.authorTime * 1000).toISOString()}) ${line.content}`)
 * }
 * 
 * @example
 * // Blame specific lines
 * const blame = await git.blame({
 *   fs,
 *   dir: '/path/to/repo',
 *   filepath: 'src/index.js',
 *   startLine: 10,
 *   endLine: 20
 * })
 * 
 * @example
 * // Blame from specific ref
 * const blame = await git.blame({
 *   fs,
 *   dir: '/path/to/repo',
 *   ref: 'v1.0.0',
 *   filepath: 'README.md'
 * })
 */
export async function blame({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  ref = "HEAD",
  filepath,
  startLine,
  endLine,
  reverse = false,
  firstParent = false
}: BlameApiOptions): Promise<BlameResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const fileSystem = new FileSystem(_fs);
    
    const options: BlameOptions = {
      startLine,
      endLine,
      reverse,
      firstParent
    };

    return await _blame({
      cache,
      fs: fileSystem,
      gitdir,
      ref,
      filepath,
      options
    });
  } catch (err: unknown) {
    (err as any).caller = "git.blame";
    throw err;
  }
}
/**
 * Git show API - Display various types of git objects
 */

import { _show, ShowFormat } from "../commands/show.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface ShowOptions {
  cache?: Cache;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  ref?: string;
  oid?: string;
  format?: ShowFormat;
}

/**
 * Show various types of git objects (commits, trees, blobs, tags)
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} [args.dir] - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.ref] - A ref to show (default: HEAD)
 * @param {string} [args.oid] - A specific object ID to show
 * @param {string} [args.format="medium"] - Output format: "raw", "pretty", "oneline", "short", "medium", "full", "fuller"
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<string>} The formatted object output
 * 
 * @example
 * // Show current commit
 * const output = await git.show({ fs, dir: '/path/to/repo' })
 * console.log(output)
 * 
 * @example
 * // Show specific commit in oneline format
 * const output = await git.show({
 *   fs,
 *   dir: '/path/to/repo',
 *   ref: 'HEAD~2',
 *   format: 'oneline'
 * })
 * 
 * @example
 * // Show a specific object by OID
 * const output = await git.show({
 *   fs,
 *   dir: '/path/to/repo',
 *   oid: 'abc123...',
 *   format: 'raw'
 * })
 * 
 * @example
 * // Show a tag
 * const output = await git.show({
 *   fs,
 *   dir: '/path/to/repo',
 *   ref: 'v1.0.0'
 * })
 */
export async function show({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = dir ? join(dir, ".git") : undefined,
  ref,
  oid,
  format = "medium"
}: ShowOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);
    
    // Either gitdir or dir must be provided
    if (!gitdir && !dir) {
      throw new Error("Either dir or gitdir must be provided");
    }
    
    if (!gitdir) {
      gitdir = join(dir!, ".git");
    }

    const fileSystem = new FileSystem(_fs);

    return await _show({
      cache,
      fs: fileSystem,
      gitdir,
      ref,
      oid,
      format
    });
  } catch (err: unknown) {
    (err as any).caller = "git.show";
    throw err;
  }
}
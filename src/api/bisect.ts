/**
 * Git bisect API - Binary search for bug introduction
 */

import { _bisectStart, _bisectGood, _bisectBad, _bisectSkip, _bisectReset, _bisectLog, _bisectReplay, _bisectRun } from "../commands/bisect.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { BisectRunResult, BisectSearchResult } from "../models/bisect-state.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface BaseBisectOptions {
  cache?: Cache;
  dir: string;
  fs: FsClient;
  gitdir?: string;
}

interface BisectStartOptions extends BaseBisectOptions {
  bad?: string;
  good?: string[];
  terms?: {
    good: string;
    bad: string;
  };
  noCheckout?: boolean;
}

interface BisectMarkOptions extends BaseBisectOptions {
  ref?: string;
}

interface BisectRunOptions extends BaseBisectOptions {
  script: string;
}

interface BisectReplayOptions extends BaseBisectOptions {
  filename: string;
}

/**
 * Start a bisect session
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.bad] - The bad commit (default: HEAD)
 * @param {string[]} [args.good] - Array of good commits
 * @param {Object} [args.terms] - Custom terms for good/bad
 * @param {boolean} [args.noCheckout=false] - Don't checkout commits during bisect
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<BisectSearchResult>} The bisect start result
 * 
 * @example
 * // Start bisect with explicit good/bad commits
 * const result = await git.bisect.start({
 *   fs,
 *   dir: '/path/to/repo',
 *   bad: 'HEAD',
 *   good: ['v1.0.0']
 * })
 * 
 * @example
 * // Start bisect with custom terms
 * const result = await git.bisect.start({
 *   fs,
 *   dir: '/path/to/repo',
 *   terms: { good: 'old', bad: 'new' }
 * })
 */
export async function bisectStart({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  bad = "HEAD",
  good = [],
  terms,
  noCheckout = false
}: BisectStartOptions): Promise<BisectSearchResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fileSystem = new FileSystem(_fs);

    return await _bisectStart({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      options: {
        bad,
        good,
        terms,
        noCheckout
      }
    });
  } catch (err: unknown) {
    (err as any).caller = "git.bisect.start";
    throw err;
  }
}

/**
 * Mark a commit as good
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.ref] - The commit to mark as good (default: current)
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<BisectSearchResult>} The bisect result after marking good
 * 
 * @example
 * // Mark current commit as good
 * const result = await git.bisect.good({ fs, dir: '/path/to/repo' })
 * 
 * @example
 * // Mark specific commit as good
 * const result = await git.bisect.good({ 
 *   fs, 
 *   dir: '/path/to/repo',
 *   ref: 'abc123'
 * })
 */
export async function bisectGood({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  ref
}: BisectMarkOptions): Promise<BisectSearchResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fileSystem = new FileSystem(_fs);

    return await _bisectGood({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      ref
    });
  } catch (err: unknown) {
    (err as any).caller = "git.bisect.good";
    throw err;
  }
}

/**
 * Mark a commit as bad
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.ref] - The commit to mark as bad (default: current)
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<BisectSearchResult>} The bisect result after marking bad
 * 
 * @example
 * // Mark current commit as bad
 * const result = await git.bisect.bad({ fs, dir: '/path/to/repo' })
 */
export async function bisectBad({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  ref
}: BisectMarkOptions): Promise<BisectSearchResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fileSystem = new FileSystem(_fs);

    return await _bisectBad({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      ref
    });
  } catch (err: unknown) {
    (err as any).caller = "git.bisect.bad";
    throw err;
  }
}

/**
 * Skip the current commit (if it cannot be tested)
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} [args.ref] - The commit to skip (default: current)
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<BisectSearchResult>} The bisect result after skipping
 * 
 * @example
 * // Skip current commit
 * const result = await git.bisect.skip({ fs, dir: '/path/to/repo' })
 */
export async function bisectSkip({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  ref
}: BisectMarkOptions): Promise<BisectSearchResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fileSystem = new FileSystem(_fs);

    return await _bisectSkip({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      ref
    });
  } catch (err: unknown) {
    (err as any).caller = "git.bisect.skip";
    throw err;
  }
}

/**
 * Reset bisect session and return to original HEAD
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<void>} Promise that resolves when reset is complete
 * 
 * @example
 * // Reset and end bisect session
 * await git.bisect.reset({ fs, dir: '/path/to/repo' })
 */
export async function bisectReset({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git")
}: BaseBisectOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fileSystem = new FileSystem(_fs);

    return await _bisectReset({
      cache,
      dir,
      fs: fileSystem,
      gitdir
    });
  } catch (err: unknown) {
    (err as any).caller = "git.bisect.reset";
    throw err;
  }
}

/**
 * Show bisect log
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<string[]>} Array of log lines
 * 
 * @example
 * // Get bisect log
 * const log = await git.bisect.log({ fs, dir: '/path/to/repo' })
 */
export async function bisectLog({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git")
}: BaseBisectOptions): Promise<string[]> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fileSystem = new FileSystem(_fs);

    return await _bisectLog({
      cache,
      dir,
      fs: fileSystem,
      gitdir
    });
  } catch (err: unknown) {
    (err as any).caller = "git.bisect.log";
    throw err;
  }
}

/**
 * Run automated bisect with a test script
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} args.script - Command to run for testing each commit
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<BisectRunResult>} The automated bisect result
 * 
 * @example
 * // Run automated bisect with test script
 * const result = await git.bisect.run({
 *   fs,
 *   dir: '/path/to/repo',
 *   script: 'npm test'
 * })
 */
export async function bisectRun({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  script
}: BisectRunOptions): Promise<BisectRunResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("script", script);

    const fileSystem = new FileSystem(_fs);
    
    return await _bisectRun({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      script
    });
  } catch (err: unknown) {
    (err as any).caller = "git.bisect.run";
    throw err;
  }
}

/**
 * Replay bisect session from log file
 * 
 * @param {Object} args
 * @param {FsClient} args.fs - The file system client
 * @param {string} args.dir - The working directory
 * @param {string} [args.gitdir] - The git directory (default: `${dir}/.git`)
 * @param {string} args.filename - File containing bisect commands to replay
 * @param {Cache} [args.cache] - Cache for performance
 * @returns {Promise<BisectSearchResult>} The replay result
 * 
 * @example
 * // Replay bisect from log file
 * const result = await git.bisect.replay({
 *   fs,
 *   dir: '/path/to/repo',
 *   filename: 'bisect.log'
 * })
 */
export async function bisectReplay({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  filename
}: BisectReplayOptions): Promise<BisectSearchResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("filename", filename);

    const fileSystem = new FileSystem(_fs);

    return await _bisectReplay({
      cache,
      dir,
      fs: fileSystem,
      gitdir,
      filename
    });
  } catch (err: unknown) {
    (err as any).caller = "git.bisect.replay";
    throw err;
  }
}

// Export the bisect API as a namespace-like object
export const bisect = {
  start: bisectStart,
  good: bisectGood,
  bad: bisectBad,
  skip: bisectSkip,
  reset: bisectReset,
  log: bisectLog,
  run: bisectRun,
  replay: bisectReplay
};
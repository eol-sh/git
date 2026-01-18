/**
 * @fileoverview git-index manager
 *
 * Manages git-index resources including creation, access, and lifecycle.
 * Provides centralized control and caching for git-index operations.
 *
 * @module managers/git-index.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import AsyncLock from "../compat/async-lock.ts";
import { compareStats } from "../utils/compare-stats.ts";
import { GitIndex } from "../models/git-index.ts";
import { UnmergedPathsError } from "../errors/unmerged-paths.ts";

interface FileSystemLike {
  lstat(filepath: string): Promise<any>;
  read(filepath: string): Promise<Uint8Array | string | null>;
  write(filepath: string, buffer: Uint8Array): Promise<void>;
}

interface IndexCacheEntry {
  map: Map<string, GitIndex>;
  stats: Map<string, any>;
}

const IndexCache = Symbol("IndexCache");
let lock: AsyncLock | null = null;



//// export

export interface GitIndexManagerAcquireOptions {
  allowUnmerged?: boolean;
  cache: Map<string, any>;
  fs: FileSystemLike;
  gitdir: string;
}

export class GitIndexManager {
  /**
   * Acquire the index file and execute a closure with it
   *
   * @param opts - Options for acquiring the index
   * @param closure - Function to execute with the GitIndex
   */
  static async acquire<T>(
    { allowUnmerged = true, cache, fs, gitdir }: GitIndexManagerAcquireOptions,
    closure: (index: GitIndex) => T
  ): Promise<T> {
    if (!cache[IndexCache])
      cache[IndexCache] = createCache();

    const filepath = `${gitdir}/index`;
    let result: T;
    let unmergedPaths: string[] = [];

    if (lock === null)
      lock = new AsyncLock();

    await lock.acquire(filepath, async() => {
      // Acquire a file lock while we’re reading the index
      // to make sure other processes aren’t writing to it
      // simultaneously, which could result in a corrupted index.
      // const fileLock = await Lock(filepath)
      const theIndexCache = cache[IndexCache] as IndexCacheEntry;

      if (await isIndexStale(fs, filepath, theIndexCache))
        await updateCachedIndexFile(fs, filepath, theIndexCache);

      const index = theIndexCache.map.get(filepath)!;
      unmergedPaths = index.unmergedPaths;

      if (unmergedPaths.length && !allowUnmerged)
        throw new UnmergedPathsError(unmergedPaths);

      result = await closure(index);

      if ((index as any)._dirty) {
        // Acquire a file lock while we’re writing the index file
        // let fileLock = await Lock(filepath)
        const buffer = await index.toObject();
        await fs.write(filepath, buffer);
        // Update cached stat value
        theIndexCache.stats.set(filepath, await fs.lstat(filepath));
        (index as any)._dirty = false;
      }
    });

    return result!;
  }
}



//// helper

function createCache(): IndexCacheEntry {
  return {
    map: new Map(),
    stats: new Map(),
  };
}

/*** Determine whether our copy of the index file is stale ***/
async function isIndexStale(fs: FileSystemLike, filepath: string, cache: IndexCacheEntry): Promise<boolean> {
  const savedStats = cache.stats.get(filepath);

  if (savedStats === undefined)
    return true;

  if (savedStats === null)
    return false;

  const currStats = await fs.lstat(filepath);

  if (currStats === null)
    return false;

  return compareStats(savedStats, currStats);
}

async function updateCachedIndexFile(fs: FileSystemLike, filepath: string, cache: IndexCacheEntry): Promise<void> {
  const [stat, rawIndexFile] = await Promise.all([
    fs.lstat(filepath),
    fs.read(filepath),
  ]);

  if (!rawIndexFile || typeof rawIndexFile === "string")
    throw new Error(`Failed to read index file ${filepath} as binary data`);

  const index = await GitIndex.from(rawIndexFile);

  /*** cache the GitIndex object so we don’t need to re-read it every time. ***/
  cache.map.set(filepath, index);

  /*** Save the stat data for the index so we know whether the cached file is stale (modified by an outside process). ***/
  cache.stats.set(filepath, stat);
}

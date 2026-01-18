/**
 * @fileoverview rm-recursive utility functions
 *
 * Utility functions for rm-recursive operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/rm-recursive.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { join } from "./join.ts";
import type { FsInterface } from "../types.ts";



//// export

/**
 * Removes the directory at the specified filepath recursively. Used internally to replicate the behavior of
 * fs.promises.rm({ force: true, recursive: true }) from Node.js 14 and above when not available. If the provided
 * filepath resolves to a file, it will be removed.
 */
export async function rmRecursive(fs: FsInterface, filepath: string): Promise<void> {
  try {
    const entries = await fs.readdir(filepath);

    /*** If readdir succeeds, it’s a directory ***/
    if (Array.isArray(entries)) {
      if (entries.length) {
        await Promise.all(
          entries.map(async(entry) => {
            const entryName = typeof entry === "string" ?
              entry :
              (entry as Deno.DirEntry).name;

            const subpath = join(filepath, entryName);
            const stat = await fs.lstat(subpath);

            if (stat) {
              return stat.isDirectory ?
                rmRecursive(fs, subpath) :
                fs.unlink(subpath);
            }
          })
        );
      }

      await fs.rmdir(filepath);
    } else {
      /*** Handle async iterable from Deno ***/
      const entryList: string[] = [];

      if (entries && typeof entries[Symbol.asyncIterator] === "function") {
        for await (const entry of entries as AsyncIterable<Deno.DirEntry>) {
          entryList.push(entry.name);
        }
      }

      if (entryList.length) {
        await Promise.all(
          entryList.map(async(entryName) => {
            const subpath = join(filepath, entryName);
            const stat = await fs.lstat(subpath);

            if (stat) {
              return stat.isDirectory ?
                rmRecursive(fs, subpath) :
                fs.unlink(subpath);
            }
          })
        );
      }

      await fs.rmdir(filepath);
    }
  } catch {
    /*** If readdir fails, try to remove as a file ***/
    try {
      await fs.unlink(filepath);
    } catch {
      /*** If both directory and file removal fail, ignore ***/
    }
  }
}




//// util

import { _packObjects } from "../commands/pack-objects.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsInterface, PackObjectsResult } from "../types.ts";



//// export

export interface PackObjectsOptions {
  cache?: Cache;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  oids: string[];
  write?: boolean;
}

/**
 * Create a packfile from an array of SHA-1 object ids
 *
 * @param args - The options for packObjects
 * @param args.fs - a file system client
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.oids - An array of SHA-1 object ids to be included in the packfile
 * @param args.write - Whether to save the packfile to disk or not
 * @param args.cache - a [cache](cache.md) object
 *
 * @returns Resolves successfully when the packfile is ready with the filename and buffer
 *
 * @example
 * // Create a packfile containing only an empty tree
 * let { packfile } = await git.packObjects({
 *   dir: "/tutorial",
 *   fs,
 *   oids: ["4b825dc642cb6eb9a060e54bf8d69288fbee4904"]
 * });
 * console.log(packfile);
 */
export async function packObjects({
  cache = new Map(),
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  oids,
  write = false
}: PackObjectsOptions): Promise<PackObjectsResult> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oids", oids);

    return await _packObjects({
      cache,
      fs: adaptFileSystem(new FileSystem(fs)),
      gitdir,
      oids,
      write
    });
  } catch(err: unknown) {
    (err as any).caller = "git.packObjects";
    throw err;
  }
}




//// util

import { _writeObject } from "../storage/write-object.ts";
import { adaptFileSystem, adaptFsForGitConfig, adaptFsInterfaceForGitIndex } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { Cache, FsClient } from "../types.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import { GitIgnoreManager } from "../managers/git-ignore.ts";
import { GitIndex } from "../models/git-index.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { join } from "../utils/join.ts";
import { MultipleGitError } from "../errors/multiple-git.ts";
import { normalizeStats } from "../utils/normalize-stats.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { posixifyPathBuffer } from "../utils/posixify-path-buffer.ts";

interface AddOptions {
  cache?: Cache;
  dir: string;
  filepath: string | string[];
  force?: boolean;
  fs: FsClient;
  gitdir?: string;
  parallel?: boolean;
}

interface AddToIndexOptions {
  autocrlf: boolean | string | undefined;
  dir: string;
  filepath: string | string[];
  force: boolean;
  fs: FileSystem;
  gitdir: string;
  index: GitIndex;
  parallel: boolean;
  unifiedFs: any;
}



//// export

/**
 * Add a file to the git index (aka staging area)
 */
export async function add({
  cache = new Map(),
  dir,
  filepath,
  force = false,
  fs: _fs,
  gitdir = join(dir, ".git"),
  parallel = true
}: AddOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const fileSystem = new FileSystem(_fs);
    const fs = adaptFileSystem(fileSystem);
    const unifiedFs = adaptFsForGitConfig(fileSystem);

    await GitIndexManager.acquire({ cache, fs: adaptFsInterfaceForGitIndex(fs), gitdir }, async(index) => {
      const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });
      const autocrlf = await config.get("core.autocrlf") as boolean | string | undefined;

      return addToIndex({
        autocrlf,
        dir,
        filepath,
        force,
        fs: fileSystem,
        gitdir,
        index,
        parallel,
        unifiedFs
      });
    });
  } catch(err: unknown) {
    (err as any).caller = "git.add";
    throw err;
  }
}



//// helper

async function addToIndex({
  autocrlf,
  dir,
  filepath,
  force,
  fs,
  gitdir,
  index,
  parallel,
  unifiedFs
}: AddToIndexOptions): Promise<any[]> {
  /*** Check ignore status: files should be ignored UNLESS they’re already in the index or force is used ***/
  const filepaths = Array.isArray(filepath) ? filepath : [filepath];

  const promises = filepaths.map(async(currentFilepath) => {
    if (!force) {
      const ignored = await GitIgnoreManager.isIgnored({
        dir,
        filepath: currentFilepath,
        fs: unifiedFs,
        gitdir
      });

      /*** If the file is ignored, only skip it if it’s not already in the index ***/
      if (ignored) {
        const alreadyInIndex = index.has({ filepath: currentFilepath });

        if (!alreadyInIndex)
          return; /*** Skip ignored files that aren’t already tracked ***/

        /*** If file is in index but ignored, still add it (git behavior) ***/
      }
    }

    const stats = await fs.lstat(join(dir, currentFilepath));

    if (!stats)
      throw new NotFoundError(currentFilepath);

    if (stats.isDirectory()) {
      const children = await fs.readdir(join(dir, currentFilepath));

      if (!children)
        return;

      if (parallel) {
        const promises = children.map((child) =>
          addToIndex({
            autocrlf,
            dir,
            filepath: [join(currentFilepath, child)],
            force,
            fs,
            gitdir,
            index,
            parallel,
            unifiedFs
          })
        );

        await Promise.all(promises);
      } else {
        for (const child of children) {
          await addToIndex({
            autocrlf,
            dir,
            filepath: [join(currentFilepath, child)],
            force,
            fs,
            gitdir,
            index,
            parallel,
            unifiedFs
          });
        }
      }
    } else {
      const object = stats.isSymbolicLink() ?
        await fs.readlink(join(dir, currentFilepath)).then(result => result ? posixifyPathBuffer(result) : new Uint8Array()) :
        await fs.read(join(dir, currentFilepath), typeof autocrlf === "string" ? { autocrlf } : {});

      if (object === null)
        throw new NotFoundError(currentFilepath);

      const objectBuffer = typeof object === "string" ?
        new TextEncoder().encode(object) :
        object;

      const oid = await _writeObject({ fs: adaptFileSystem(fs), gitdir, object: objectBuffer, type: "blob" });

      const normalizedStats = normalizeStats({
        ...stats,
        dev: stats.dev ?? 0,
        gid: stats.gid ?? 0,
        ino: stats.ino ?? 0,
        uid: stats.uid ?? 0
      });

      index.insert({ filepath: currentFilepath, oid, stats: normalizedStats });
    }
  });

  const settledPromises = await Promise.allSettled(promises);

  const rejectedPromises = settledPromises
    .filter((settle): settle is PromiseRejectedResult => settle.status === "rejected")
    .map((settle) => settle.reason);

  if (rejectedPromises.length > 1)
    throw new MultipleGitError(rejectedPromises);

  if (rejectedPromises.length === 1)
    throw rejectedPromises[0];

  const fulfilledPromises = settledPromises
    .filter((settle): settle is PromiseFulfilledResult<any> => settle.status === "fulfilled" && settle.value !== undefined)
    .map((settle) => settle.value);

  return fulfilledPromises;
}

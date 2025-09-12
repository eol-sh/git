


//// util

import { _writeObject } from "../storage/write-object.ts";
import { adaptFileSystem, adaptFsInterfaceForGitIndex } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { InvalidFilepathError } from "../errors/invalid-filepath.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";



//// export

/**
 * Register file contents in the working tree or object database to the git index (aka staging area).
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, ".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - File to act upon.
 * @param {string} [args.oid] - OID of the object in the object database to add to the index with the specified filepath.
 * @param {number} [args.mode = 100644] - The file mode to add the file to the index.
 * @param {boolean} [args.add] - Adds the specified file to the index if it does not yet exist in the index.
 * @param {boolean} [args.remove] - Remove the specified file from the index if it does not exist in the workspace anymore.
 * @param {boolean} [args.force] - Remove the specified file from the index, even if it still exists in the workspace.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<string | void>} Resolves successfully with the SHA-1 object id of the object written or updated in the index, or nothing if the file was removed.
 *
 * @example
 * await git.updateIndex({
 *   dir: "/tutorial",
 *   filepath: "readme.md",
 *   fs
 * });
 *
 * @example
 * // Manually create a blob in the object database.
 * let oid = await git.writeBlob({
 *   blob: new Uint8Array([]),
 *   dir: "/tutorial",
 *   fs
 * });
 *
 * // Write the object in the object database to the index.
 * await git.updateIndex({
 *   add: true,
 *   dir: "/tutorial",
 *   filepath: "readme.md",
 *   fs,
 *   oid
 * });
 */
export async function updateIndex({
  add,
  cache = new Map(),
  dir,
  filepath,
  force,
  fs: _fs,
  gitdir = join(dir, ".git"),
  mode,
  oid,
  remove
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const fileSystem = new FileSystem(_fs);
    const fs = adaptFileSystem(fileSystem);

    if (remove) {
      return await GitIndexManager.acquire(
        { cache, fs: adaptFsInterfaceForGitIndex(_fs), gitdir },
        async(index) => {
          if (!force) {
            /*** Check if the file is still present in the working directory ***/
            const fileStats = await fileSystem.lstat(join(dir, filepath));

            if (fileStats) {
              if (fileStats.isDirectory()) {
                /*** Removing directories should not work ***/
                throw new InvalidFilepathError("directory");
              }

              /*** Do nothing if we don’t force and the file still exists in the workdir ***/
              return;
            }
          }

          /*** Directories are not allowed, so we make sure the provided filepath exists in the index ***/
          if (index.has({ filepath }))
            index.delete({ filepath });
        }
      );
    }

    /*** Test if it is a file and exists on disk if `remove` is not provided, only of no oid is provided ***/
    let fileStats;

    if (!oid) {
      fileStats = await fileSystem.lstat(join(dir, filepath));

      if (!fileStats)
        throw new NotFoundError(`file at "${filepath}" on disk and "remove" not set`);

      if (fileStats.isDirectory())
        throw new InvalidFilepathError("directory");
    }

    return await GitIndexManager.acquire({ cache, fs: adaptFsInterfaceForGitIndex(fs), gitdir }, async(index) => {
      if (!add && !index.has({ filepath })) {
        /*** If the index does not contain the filepath yet and `add` is not set, we should throw ***/
        throw new NotFoundError(`file at "${filepath}" in index and "add" not set`);
      }

      let stats;

      if (!oid) {
        stats = fileStats;

        /*** Write the file to the object database ***/
        const rawObject = stats.isSymbolicLink() ?
          await fileSystem.readlink(join(dir, filepath)) :
          await fileSystem.read(join(dir, filepath));

        if (rawObject === null)
          throw new NotFoundError(`file content at "${filepath}"`);

        const object = typeof rawObject === "string" ?
          new TextEncoder().encode(rawObject) :
          rawObject;

        oid = await _writeObject({
          format: "content",
          fs,
          gitdir,
          object,
          type: "blob"
        });
      } else {
        /*** By default we use 0 for the stats of the index file ***/
        stats = {
          ctime: new Date(0),
          dev: 0,
          gid: 0,
          ino: 0,
          mode,
          mtime: new Date(0),
          size: 0,
          uid: 0
        };
      }

      index.insert({
        filepath,
        oid: oid,
        stats
      });

      return oid;
    });
  } catch(err: unknown) {
    (err as any).caller = "git.updateIndex";
    throw err;
  }
}

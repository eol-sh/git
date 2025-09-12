


//// util

import { adaptFileSystem, adaptFsInterface, adaptFsInterfaceForGitIndex } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { hashObject } from "../utils/hash-object.ts";
import { join } from "../utils/join.ts";
import { resolveFilepath } from "../utils/resolve-filepath.ts";



//// export

/**
 * Reset a file in the git index (aka staging area)
 *
 * Note that this does NOT modify the file in the working directory.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, ".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.filepath - The path to the file to reset in the index
 * @param {string} [args.ref = "HEAD"] - A ref to the commit to use
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<void>} Resolves successfully once the git index has been updated
 *
 * @example
 * await git.resetIndex({ dir: "/tutorial", filepath: "README.md", fs });
 * console.log("done");
 */
export async function resetIndex({
  cache = new Map(),
  dir,
  filepath,
  fs: _fs,
  gitdir = join(dir, ".git"),
  ref
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const fileSystem = new FileSystem(_fs);
    const fs = adaptFileSystem(fileSystem);
    const unifiedFs = adaptFsInterface(_fs);
    const indexFs = adaptFsInterfaceForGitIndex(_fs);

    let oid;
    let workdirOid;

    try {
      /*** Resolve commit ***/
      oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: ref || "HEAD" });
    } catch(e) {
      if (ref) {
        /*** Only throw the error if a ref is explicitly provided ***/
        throw e;
      }
    }

    /*** Not having an oid at this point means `resetIndex()` was called without explicit `ref` on a new git
    repository. If that happens, we can skip resolving the file path. ***/
    if (oid) {
      try {
        /*** Resolve blob ***/
        oid = await resolveFilepath({
          cache,
          filepath,
          fs,
          gitdir,
          oid
        });
      } catch {
        /*** This means we’re resetting the file to a "deleted" state ***/
        oid = null;
      }
    }

    /*** For files that aren’t in the workdir use zeros ***/
    let stats = {
      ctime: new Date(0),
      dev: 0,
      gid: 0,
      ino: 0,
      mode: 0,
      mtime: new Date(0),
      size: 0,
      uid: 0
    };

    /*** If the file exists in the workdir... ***/
    const object = dir && (await fileSystem.read(join(dir, filepath)));

    if (object) {
      /*** ... and has the same hash as the desired state... ***/
      workdirOid = await hashObject({
        gitdir,
        object,
        type: "blob"
      });

      if (oid === workdirOid) {
        /*** ... use the workdir Stats object ***/
        const lstatResult = await fileSystem.lstat(join(dir, filepath));

        if (lstatResult) {
          stats = {
            ctime: lstatResult.ctime || new Date(),
            dev: lstatResult.dev || 0,
            gid: lstatResult.gid || 0,
            ino: lstatResult.ino || 0,
            mode: lstatResult.mode || 0,
            mtime: lstatResult.mtime || new Date(),
            size: lstatResult.size || 0,
            uid: lstatResult.uid || 0
          };
        }
      }
    }

    await GitIndexManager.acquire(
      { cache, fs: indexFs, gitdir },
      (index) => {
        index.delete({ filepath });

        if (oid)
          index.insert({ filepath, oid, stats });
      }
    );
  } catch(err: unknown) {
    (err as any).caller = "git.reset";
    throw err;
  }
}

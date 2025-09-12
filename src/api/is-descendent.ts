


//// util

import "../typedefs.ts";

import { _isDescendent } from "../commands/is-descendent.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { join } from "../utils/join.ts";



//// export

/**
 * Check whether a git commit is descended from another
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.oid - The descendent commit
 * @param {string} args.ancestor - The (proposed) ancestor commit
 * @param {number} [args.depth = -1] - Maximum depth to search before giving up. -1 means no maximum depth.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<boolean>} Resolves to true if `oid` is a descendent of `ancestor`
 *
 * @example
 * let oid = await git.resolveRef({ dir: "/tutorial", fs, ref: "main" });
 * let ancestor = await git.resolveRef({ dir: "/tutorial", fs, ref: "v0.20.0" });
 * console.log(oid, ancestor);
 * await git.isDescendent({ ancestor, depth: -1, dir: "/tutorial", fs, oid });
 */
export async function isDescendent({
  ancestor,
  cache = new Map(),
  depth = -1,
  dir,
  fs: _fs,
  gitdir = join(dir, ".git"),
  oid
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);
    assertParameter("ancestor", ancestor);

    const fs = adaptFileSystem(new FileSystem(_fs));

    return await _isDescendent({
      ancestor,
      cache,
      depth,
      fs,
      gitdir,
      oid
    });
  } catch(err) {
    (err as any).caller = "git.isDescendent";
    throw err;
  }
}

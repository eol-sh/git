


//// util

import { adaptFsForGitRef } from "../utils/fs-adapter.ts";
import { AlreadyExistsError } from "../errors/already-exists.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";
import { MissingParameterError } from "../errors/missing-parameter.ts";



//// export

/**
 * Create a lightweight tag
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - What to name the tag
 * @param {string} [args.object = "HEAD"] - What oid the tag refers to. (Will resolve to oid if value is a ref.) By default, the commit object which is referred by the current `HEAD` is used.
 * @param {boolean} [args.force = false] - Instead of throwing an error if a tag named `ref` already exists, overwrite the existing tag.
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.tag({ dir: "/tutorial", fs, ref: "test-tag" });
 * console.log("done");
 */
export async function tag({
  dir,
  force = false,
  fs: _fs,
  gitdir = join(dir, ".git"),
  object,
  ref
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);

    const fileSystem = new FileSystem(_fs);

    if (ref === undefined)
      throw new MissingParameterError("ref");

    ref = ref.startsWith("refs/tags/") ?
      ref :
      `refs/tags/${ref}`;

    /*** Resolve passed object ***/
    const value = await GitRefManager.resolve({
      fs: adaptFsForGitRef(fileSystem),
      gitdir,
      ref: object || "HEAD"
    });

    if (!force && (await GitRefManager.exists({ fs: adaptFsForGitRef(fileSystem), gitdir, ref })))
      throw new AlreadyExistsError("tag", ref);

    await GitRefManager.writeRef({ fs: adaptFsForGitRef(fileSystem), gitdir, ref, value });
  } catch(err) {
    (err as any).caller = "git.tag";
    throw err;
  }
}




//// util

import "../typedefs.ts";

import { _writeTag } from "../commands/write-tag.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";



//// export

/**
 * Write an annotated tag object directly
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {TagObject} args.tag - The object to write
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object
 * @see TagObject
 *
 * @example
 * // Manually create an annotated tag.
 * let sha = await git.resolveRef({ dir: "/tutorial", fs, ref: "HEAD" });
 * console.log("commit", sha);
 *
 * let oid = await git.writeTag({
 *   dir: "/tutorial",
 *   fs,
 *   tag: {
 *     message: "Optional message",
 *     object: sha,
 *     tag: "my-tag",
 *     tagger: {
 *       email: "email@example.com",
 *       name: "your name",
 *       timestamp: Math.floor(Date.now()/1000),
 *       timezoneOffset: new Date().getTimezoneOffset()
 *     },
 *     type: "commit"
 *   }
 * });
 *
 * console.log("tag", oid);
 */
export async function writeTag({ dir, fs, gitdir = join(dir, ".git"), tag }) {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("tag", tag);

    return await _writeTag({
      fs: adaptFsInterface(fs),
      gitdir,
      tag
    });
  } catch(err) {
    (err as any).caller = "git.writeTag";
    throw err;
  }
}

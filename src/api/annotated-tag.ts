/**
 * @fileoverview Git annotated-tag API - High-level user interface
 *
 * This module provides the public API for annotated-tag operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/annotated-tag.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import "../typedefs.ts";

import { _annotatedTag } from "../commands/annotated-tag.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";
import { MissingNameError } from "../errors/missing-name.ts";
import { normalizeAuthorObject } from "../utils/normalize-author-object.ts";



//// export

/**
 * Create an annotated tag.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {SignCallback} [args.onSign] - a PGP signing implementation
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} args.ref - What to name the tag
 * @param {string} [args.message = ref] - The tag message to use.
 * @param {string} [args.object = "HEAD"] - The SHA-1 object id the tag points to. (Will resolve to a SHA-1 object id if value is a ref.) By default, the commit object which is referred by the current `HEAD` is used.
 * @param {object} [args.tagger] - The details about the tagger.
 * @param {string} [args.tagger.name] - Default is `user.name` config.
 * @param {string} [args.tagger.email] - Default is `user.email` config.
 * @param {number} [args.tagger.timestamp=Math.floor(Date.now()/1000)] - Set the tagger timestamp field. This is the integer number of seconds since the Unix epoch (1970-01-01 00:00:00).
 * @param {number} [args.tagger.timezoneOffset] - Set the tagger timezone offset field. This is the difference, in minutes, from the current timezone to UTC. Default is `(new Date()).getTimezoneOffset()`.
 * @param {string} [args.gpgsig] - The gpgsig attached to the tag object. (Mutually exclusive with the `signingKey` option.)
 * @param {string} [args.signingKey] - Sign the tag object using this private PGP key. (Mutually exclusive with the `gpgsig` option.)
 * @param {boolean} [args.force = false] - Instead of throwing an error if a tag named `ref` already exists, overwrite the existing tag. Note that this option does not modify the original tag object itself.
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<void>} Resolves successfully when filesystem operations are complete
 *
 * @example
 * await git.annotatedTag({
 *   dir: "/tutorial",
 *   fs,
 *   message: "This commit is awesome",
 *   ref: "test-tag",
 *   tagger: {
 *     email: "mrtest@example.com",
 *     name: "Mr. Test"
 *   }
 * });
 *
 * console.log("done");
 */
export async function annotatedTag({
  cache = new Map(),
  dir,
  force = false,
  fs: _fs,
  gitdir = join(dir, ".git"),
  gpgsig,
  message,
  object,
  onSign,
  ref,
  signingKey,
  tagger: _tagger
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);

    if (signingKey)
      assertParameter("onSign", onSign);

    /*** Set default message if not provided ***/
    if (!message)
      message = ref;

    const fs = adaptFileSystem(new FileSystem(_fs));

    /*** Fill in missing arguments with default values ***/
    const tagger = await normalizeAuthorObject({
      author: _tagger || {},
      fs,
      gitdir
    });

    if (!tagger)
      throw new MissingNameError("tagger");

    return await _annotatedTag({
      cache,
      force,
      fs,
      gitdir,
      gpgsig,
      message,
      object,
      onSign,
      ref,
      signingKey,
      tagger
    });
  } catch(err: unknown) {
    (err as any).caller = "git.annotatedTag";
    throw err;
  }
}

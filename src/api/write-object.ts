/**
 * @fileoverview Git write-object API - High-level user interface
 *
 * This module provides the public API for write-object operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/write-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// import


//// util

import "../typedefs.ts";

import { _writeObject } from "../storage/write-object.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitTree } from "../models/git-tree.ts";
import { join } from "../utils/join.ts";
import { ObjectTypeError } from "../errors/object-type.ts";

import type { CommitObject, FsInterface, TagObject, TreeObject } from "../types.ts";

export interface WriteObjectOptions {
  dir?: string;
  format?: "content" | "deflated" | "parsed" | "wrapped";
  fs: FsInterface;
  gitdir?: string;
  object: string | CommitObject | TagObject | TreeObject | Uint8Array;
  oid?: string;
  type?: "blob" | "commit" | "tag" | "tree";
}



//// export

/**
 * Write a git object directly
 *
 * `format` can have the following values:
 *
 * | param      | description                                                                                                                                                      |
 * | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 * | "deflated" | Treat `object` as the raw deflate-compressed buffer for an object, meaning can be written to `.git/objects/**` as-is.                                            |
 * | "wrapped"  | Treat `object` as the inflated object buffer wrapped in the git object header. This is the raw buffer used when calculating the SHA-1 object id of a git object. |
 * | "content"  | Treat `object` as the object buffer without the git header.                                                                                                      |
 * | "parsed"   | Treat `object` as a parsed representation of the object.                                                                                                         |
 *
 * If `format` is `"parsed"`, then `object` must match one of the schemas for `CommitObject`, `TreeObject`, `TagObject`, or a `string` (for blobs).
 *
 * {@link CommitObject typedef}
 *
 * {@link TreeObject typedef}
 *
 * {@link TagObject typedef}
 *
 * If `format` is `"content"`, `"wrapped"`, or `"deflated"`, `object` should be a `Uint8Array`.
 *
 * @deprecated
 * > This command is overly complicated.
 * >
 * > If you know the type of object you are writing, use [`writeBlob`](./writeBlob.md), [`writeCommit`](./writeCommit.md), [`writeTag`](./writeTag.md), or [`writeTree`](./writeTree.md).
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system client
 * @param {string} [args.dir] - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir,".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string | Uint8Array | CommitObject | TreeObject | TagObject} args.object - The object to write.
 * @param {"blob"|"tree"|"commit"|"tag"} [args.type] - The kind of object to write.
 * @param {"deflated" | "wrapped" | "content" | "parsed"} [args.format = "parsed"] - What format the object is in. The possible choices are listed below.
 * @param {string} [args.oid] - If `format` is `"deflated"` then this param is required. Otherwise it is calculated.
 * @param {string} [args.encoding] - If `type` is `"blob"` then `object` will be converted to a Uint8Array using `encoding`.
 *
 * @returns {Promise<string>} Resolves successfully with the SHA-1 object id of the newly written object.
 *
 * @example
 * // Manually create an annotated tag.
 * let sha = await git.resolveRef({ dir: "/tutorial", fs, ref: "HEAD" });
 * console.log("commit", sha);
 *
 * let oid = await git.writeObject({
 *   dir: "/tutorial",
 *   fs,
 *   object: {
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
 *   },
 *   type: "tag"
 * });
 *
 * console.log("tag", oid);
 */
export async function writeObject({
  dir,
  format = "parsed",
  fs: _fs,
  gitdir = join(dir!, ".git"),
  object,
  oid,
  type
}: WriteObjectOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("object", object);

    /*** Convert object to buffer ***/
    if (format === "parsed") {
      switch(type) {
        case "commit": {
          object = GitCommit.from(object as CommitObject).toObject();
          break;
        }

        case "tree": {
          object = GitTree.from(object as TreeObject).toObject();
          break;
        }

        case "blob": {
          object = typeof object === "string" ? new TextEncoder().encode(object) : object as Uint8Array;
          break;
        }

        case "tag": {
          object = GitAnnotatedTag.from(object as TagObject).toObject();
          break;
        }

        default: {
          throw new ObjectTypeError(oid || "", (type || "blob") as any, "blob");
        }
      }

      /*** GitObjectManager does not know how to serialize content, so we tweak that parameter before passing it. ***/
      format = "content";
    }

    oid = await _writeObject({
      format,
      fs: _fs,
      gitdir,
      object: object as Uint8Array,
      ...(oid ? { oid } : {}),
      type: type || "blob"
    });

    return oid;
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.writeObject";

    throw error;
  }
}

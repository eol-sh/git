/**
 * @fileoverview Git read-object API - High-level user interface
 *
 * This module provides the public API for read-object operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/read-object.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { _readObject } from "../storage/read-object.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitTree } from "../models/git-tree.ts";
import { join } from "../utils/join.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { resolveFilepath } from "../utils/resolve-filepath.ts";

import type { Cache, FsInterface, ReadObjectResult } from "../types.ts";



//// export

export interface ReadObjectOptions {
  cache?: Cache;
  dir?: string;
  encoding?: string;
  filepath?: string;
  format?: "content" | "deflated" | "parsed" | "wrapped";
  fs: FsInterface;
  gitdir?: string;
  oid: string;
}

/**
 * Read a git object directly by its SHA-1 object id
 *
 * Regarding `ReadObjectResult`:
 *
 * - `oid` will be the same as the `oid` argument unless the `filepath` argument is provided, in which case it will be the oid of the tree or blob being returned.
 * - `type` of deflated objects is `"deflated"`, and `type` of wrapped objects is `"wrapped"`
 * - `format` is usually, but not always, the format you requested. Packfiles do not store each object individually compressed so if you end up reading the object from a packfile it will be returned in format "content" even if you requested "deflated" or "wrapped".
 * - `object` will be an actual Object if format is "parsed" and the object is a commit, tree, or annotated tag. Blobs are still formatted as Buffers unless an encoding is provided in which case they’ll be strings. If format is anything other than "parsed", object will be a Buffer.
 * - `source` is the name of the packfile or loose object file where the object was found.
 *
 * The `format` parameter can have the following values:
 *
 * | param      | description                                                                                                                                                                                               |
 * | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 * | "deflated" | Return the raw deflate-compressed buffer for an object if possible. Useful for efficiently shuffling around loose objects when you don’t care about the contents and can save time by not inflating them. |
 * | "wrapped"  | Return the inflated object buffer wrapped in the git object header if possible. This is the raw data used when calculating the SHA-1 object id of a git object.                                           |
 * | "content"  | Return the object buffer without the git header.                                                                                                                                                          |
 * | "parsed"   | Returns a parsed representation of the object.                                                                                                                                                            |
 *
 * The result will be in one of the following schemas:
 *
 * ## `"deflated"` format
 *
 * {@link DeflatedObject typedef}
 *
 * ## `"wrapped"` format
 *
 * {@link WrappedObject typedef}
 *
 * ## `"content"` format
 *
 * {@link RawObject typedef}
 *
 * ## `"parsed"` format
 *
 * ### parsed `"blob"` type
 *
 * {@link ParsedBlobObject typedef}
 *
 * ### parsed `"commit"` type
 *
 * {@link ParsedCommitObject typedef}
 * {@link CommitObject typedef}
 *
 * ### parsed `"tree"` type
 *
 * {@link ParsedTreeObject typedef}
 * {@link TreeObject typedef}
 * {@link TreeEntry typedef}
 *
 * ### parsed `"tag"` type
 *
 * {@link ParsedTagObject typedef}
 * {@link TagObject typedef}
 *
 * @deprecated
 * > This command is overly complicated.
 * >
 * > If you know the type of object you are reading, use [`readBlob`](./readBlob.md), [`readCommit`](./readCommit.md), [`readTag`](./readTag.md), or [`readTree`](./readTree.md).
 *
 * @param args - The options for readObject
 * @param args.fs - a file system client
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.oid - The SHA-1 object id to get
 * @param args.format - What format to return the object in. The choices are described in more detail below.
 * @param args.filepath - Don’t return the object with `oid` itself, but resolve `oid` to a tree and then return the object at that filepath. To return the root directory of a tree set filepath to `""`
 * @param args.encoding - A convenience argument that only affects blobs. Instead of returning `object` as a buffer, it returns a string parsed using the given encoding.
 * @param args.cache - a [cache](cache.md) object
 *
 * @returns Resolves successfully with a git object description
 *
 * @example
 * // Given a ransom SHA-1 object id, figure out what it is
 * let { object, type } = await git.readObject({
 *   dir: "/tutorial",
 *   fs,
 *   oid: "0698a781a02264a6f37ba3ff41d78067eaf0f075"
 * });
 *
 * switch(type) {
 *   case "commit": {
 *     console.log(object)
 *     break
 *   }
 *
 *   case "tree": {
 *     console.log(object)
 *     break
 *   }
 *
 *   case "blob": {
 *     console.log(object)
 *     break
 *   }
 *
 *   case "tag": {
 *     console.log(object)
 *     break
 *   }
 * }
 */
export async function readObject({
  cache = new Map(),
  dir,
  encoding = undefined,
  filepath = undefined,
  format = "parsed",
  fs: _fs,
  gitdir = join(dir!, ".git"),
  oid
}: ReadObjectOptions): Promise<ReadObjectResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    const fs = adaptFileSystem(new FileSystem(_fs));
    let resolvedOid = oid;

    if (filepath !== undefined) {
      resolvedOid = await resolveFilepath({
        cache,
        filepath,
        fs,
        gitdir,
        oid
      });
    }

    /*** GitObjectManager does not know how to parse content, so we tweak that parameter before passing it. ***/
    const _format = format === "parsed" ?
      "content" :
      format;

    const result: any = await _readObject({
      cache,
      format: _format,
      fs,
      gitdir,
      oid: resolvedOid
    });

    result.oid = resolvedOid;

    if (format === "parsed") {
      result.format = "parsed";

      switch(result.type) {
        case "commit": {
          result.object = GitCommit.from(result.object).parse();
          break;
        }

        case "tree": {
          result.object = GitTree.from(result.object).entries();
          break;
        }

        case "blob": {
          /*** Here we consider returning a raw Buffer as the "content" format
          and returning a string as the "parsed" format ***/
          if (encoding) {
            result.object = result.object.toString(encoding);
          } else {
            result.object = new Uint8Array(result.object);
            result.format = "content";
          }

          break;
        }

        case "tag": {
          result.object = GitAnnotatedTag.from(result.object).parse();
          break;
        }

        default: {
          throw new ObjectTypeError(
            result.oid,
            result.type,
            "blob" as any
          );
        }
      }
    } else if (result.format === "deflated" || result.format === "wrapped") {
      result.type = result.format;
    }

    return result as ReadObjectResult;
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.readObject";

    throw error;
  }
}

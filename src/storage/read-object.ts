


//// util

import { GitObject } from "../models/git-object.ts";
import { inflate } from "../utils/inflate.ts";
import { InternalError } from "../errors/internal.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { readObjectLoose } from "../storage/read-object-loose.ts";
import { readObjectPacked } from "../storage/read-object-packed.ts";
import { shasum } from "../utils/shasum.ts";

import type { FsInterface } from "../types.ts";

type ReadObjectFormat = "content" | "deflated" | "wrapped";

interface ReadObjectOptions {
  cache: Map<string, unknown>;
  format?: ReadObjectFormat;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}

interface ReadObjectResult {
  format: ReadObjectFormat;
  object: Uint8Array;
  source?: string;
  type?: string;
}



//// export

/*** Simplified version - only supports loose objects for now ***/
export async function _readObject({
  cache,
  format = "content",
  fs,
  gitdir,
  oid
}: ReadObjectOptions): Promise<ReadObjectResult> {
  let result: ReadObjectResult | null;

  /*** Empty tree - hard-coded so we can use it as a shorthand.
  Note: I think the canonical git implementation must do this too because
  `git cat-file -t 4b825dc642cb6eb9a060e54bf8d69288fbee4904` prints "tree" even in empty repos. ***/
  if (oid === "4b825dc642cb6eb9a060e54bf8d69288fbee4904") {
    result = {
      format: "wrapped" as const,
      object: new TextEncoder().encode(`tree 0\x00`)
    };
  } else {
    /*** Look for it in the loose object directory. ***/
    result = await readObjectLoose({ fs, gitdir, oid });
  }

  /*** Check to see if it’s in a packfile. ***/
  if (!result) {
    result = await readObjectPacked({
      cache,
      format,
      fs,
      gitdir,
      oid
    });
  }

  /*** If we still haven’t found it, it doesn’t exist ***/
  if (!result)
    throw new NotFoundError(oid);

  /*** Loose objects are always deflated, return early ***/
  if (format === "deflated")
    return result;

  /*** All loose objects are deflated but the hard-coded empty tree is `wrapped` so we have to check if we need to inflate the object. ***/
  if (result.format === "deflated") {
    result.object = await inflate(result.object);
    result.format = "wrapped";
  }

  if (format === "wrapped")
    return result;

  const sha = await shasum(result.object);

  if (sha !== oid)
    throw new InternalError(`SHA check failed! Expected ${oid}, computed ${sha}`);

  const { object, type } = GitObject.unwrap(result.object);

  result.type = type;
  result.object = object;
  result.format = "content";

  if (format === "content")
    return result;

  throw new InternalError(`invalid requested format "${format}"`);
}

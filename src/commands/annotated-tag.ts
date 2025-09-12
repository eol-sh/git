


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { AlreadyExistsError } from "../errors/already-exists.ts";
import { GitAnnotatedTag } from "../models/git-annotated-tag.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { _readObject as readObject } from "../storage/read-object.ts";
import { _writeObject as writeObject } from "../storage/write-object.ts";

import type { Author, Cache, FsInterface, SignCallback } from "../types.ts";

interface AnnotatedTagOptions {
  cache: Cache;
  force?: boolean;
  fs: FsInterface;
  gitdir: string;
  gpgsig?: string;
  message?: string;
  object?: string;
  onSign?: SignCallback;
  ref: string;
  signingKey?: string;
  tagger?: Author;
}



//// export

/**
 * Create an annotated tag.
 */
export async function _annotatedTag({
  cache,
  force = false,
  fs,
  gitdir,
  gpgsig,
  message,
  object,
  onSign,
  ref,
  signingKey,
  tagger
}: AnnotatedTagOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);

  if (!message)
    message = ref;

  ref = ref.startsWith("refs/tags/") ?
    ref :
    `refs/tags/${ref}`;

  if (!force && (await GitRefManager.exists({ fs: unifiedFs, gitdir, ref })))
    throw new AlreadyExistsError("tag", ref);

  /*** Resolve passed value ***/
  const oid = await GitRefManager.resolve({
    fs: unifiedFs,
    gitdir,
    ref: object || "HEAD"
  });

  const { type } = await readObject({ cache, fs, gitdir, oid });

  let tagObject = GitAnnotatedTag.from({
    gpgsig: gpgsig ?? "",
    message: message ?? "",
    object: oid,
    tag: ref.replace("refs/tags/", ""),
    tagger: tagger ?? { email: "", name: "", timestamp: Math.floor(Date.now() / 1000), timezoneOffset: 0 },
    type: type as "blob" | "commit" | "tag" | "tree"
  });

  if (signingKey && onSign) {
    const signAdapter = async (options: { payload: string; secretKey: string }) => ({
      signature: await onSign(options.payload)
    });

    tagObject = await GitAnnotatedTag.sign(tagObject, signAdapter, signingKey);
  }

  const value = await writeObject({
    fs,
    gitdir,
    object: tagObject.toObject(),
    type: "tag"
  });

  await GitRefManager.writeRef({ fs: unifiedFs, gitdir, ref, value });
}

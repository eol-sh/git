


//// util

import { GitObject } from "../models/git-object.ts";
import { shasum } from "../utils/shasum.ts";

interface HashObjectOptions {
  gitdir?: string;
  object: Uint8Array;
  type: "blob" | "commit" | "tag" | "tree";
}



//// export

export async function hashObject({ gitdir: _gitdir, object, type }: HashObjectOptions): Promise<string> {
  return await shasum(GitObject.wrap({ object, type }));
}




//// util

import { GitObject } from "../models/git-object.ts";
import { shasum } from "../utils/shasum.ts";

interface HashObjectOptions {
  format?: "content" | "wrapped" | "deflated";
  object: Uint8Array;
  oid?: string;
  type: string;
}

interface HashObjectResult {
  object: Uint8Array;
  oid: string;
}



//// export

export async function hashObject({
  format = "content",
  object,
  oid = undefined,
  type
}: HashObjectOptions): Promise<HashObjectResult> {
  let resultOid = oid;
  let resultObject = object;

  if (format !== "deflated") {
    if (format !== "wrapped")
      resultObject = GitObject.wrap({ object, type });

    resultOid = await shasum(resultObject);
  }

  return { object: resultObject, oid: resultOid! };
}

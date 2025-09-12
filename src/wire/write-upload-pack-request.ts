


//// util

import { GitPktLine } from "../models/git-pkt-line.ts";

interface WriteUploadPackRequestOptions {
  capabilities?: string[];
  depth?: number | null;
  exclude?: string[];
  haves?: string[];
  since?: Date | null;
  shallows?: string[];
  wants?: string[];
}



//// export

export function writeUploadPackRequest({
  capabilities = [],
  depth = null,
  exclude = [],
  haves = [],
  since = null,
  shallows = [],
  wants = []
}: WriteUploadPackRequestOptions): Uint8Array[] {
  const packstream: Uint8Array[] = [];
  let firstLineCapabilities = ` ${capabilities.join(" ")}`;

  wants = [...new Set(wants)]; /*** remove duplicates ***/

  for (const oid of wants) {
    packstream.push(GitPktLine.encode(`want ${oid}${firstLineCapabilities}\n`));
    firstLineCapabilities = "";
  }

  for (const oid of shallows) {
    packstream.push(GitPktLine.encode(`shallow ${oid}\n`));
  }

  if (depth !== null)
    packstream.push(GitPktLine.encode(`deepen ${depth}\n`));

  if (since !== null) {
    packstream.push(
      GitPktLine.encode(`deepen-since ${Math.floor(since.valueOf() / 1000)}\n`)
    );
  }

  for (const oid of exclude) {
    packstream.push(GitPktLine.encode(`deepen-not ${oid}\n`));
  }

  packstream.push(GitPktLine.flush());

  for (const oid of haves) {
    packstream.push(GitPktLine.encode(`have ${oid}\n`));
  }

  packstream.push(GitPktLine.encode(`done\n`));
  return packstream;
}




//// util

import { GitPktLine } from "../models/git-pkt-line.ts";

interface Triplet {
  fullRef: string;
  oid: string;
  oldoid: string;
}

interface WriteReceivePackRequestOptions {
  capabilities?: string[];
  triplets?: Triplet[];
}



//// export

export function writeReceivePackRequest({ capabilities = [], triplets = [] }: WriteReceivePackRequestOptions): Uint8Array[] {
  const packstream: Uint8Array[] = [];
  let capsFirstLine = `\x00 ${capabilities.join(" ")}`;

  for (const trip of triplets) {
    packstream.push(
      GitPktLine.encode(`${trip.oldoid} ${trip.oid} ${trip.fullRef}${capsFirstLine}\n`)
    );

    capsFirstLine = "";
  }

  packstream.push(GitPktLine.flush());
  return packstream;
}

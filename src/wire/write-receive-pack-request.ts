/**
 * @fileoverview write-receive-pack-request wire protocol implementation
 *
 * Handles write-receive-pack-request wire protocol operations for Git network
 * communication including parsing and serialization.
 *
 * @module wire/write-receive-pack-request.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */

/*** UTILITY ------------------------------------------ ***/

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

/*** EXPORT ------------------------------------------- ***/

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

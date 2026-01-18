/**
 * @fileoverview parse-upload-pack-response wire protocol implementation
 *
 * Handles parse-upload-pack-response wire protocol operations for Git network
 * communication including parsing and serialization.
 *
 * @module wire/parse-upload-pack-response.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { GitSideBand } from "../models/git-side-band.ts";
import { InvalidOidError } from "../errors/invalid-oid.ts";



//// export

export async function parseUploadPackResponse(stream: any): Promise<{
  acks: any[];
  nak: boolean;
  packfile: any;
  progress: any;
  shallows: any[];
  unshallows: any[];
}> {
  const { packfile, packetlines, progress } = GitSideBand.demux(stream);
  const acks: any[] = [];
  const shallows: any[] = [];
  const unshallows: any[] = [];
  let done = false;
  let nak = false;

  for await (const data of packetlines as any) {
    const line = data.toString().trim();

    if (line.startsWith("shallow")) {
      const oid = line.slice(-41).trim();

      if (oid.length !== 40) {
        return new Promise((_resolve, reject) => {
          reject(new InvalidOidError(oid));
        });
      }

      shallows.push(oid);
    } else if (line.startsWith("unshallow")) {
      const oid = line.slice(-41).trim();

      if (oid.length !== 40) {
        return new Promise((_resolve, reject) => {
          reject(new InvalidOidError(oid));
        });
      }

      unshallows.push(oid);
    } else if (line.startsWith("ACK")) {
      const [, oid, status] = line.split(" ");
      acks.push({ oid, status });

      if (!status)
        done = true;
    } else if (line.startsWith("NAK")) {
      nak = true;
      done = true;
    } else {
      done = true;
      nak = true;
    }

    if (done) {
      return new Promise((resolve, reject) => {
        stream.error ?
          reject(stream.error) :
          resolve({ acks, nak, packfile, progress, shallows, unshallows })
      });
    }
  }

  return new Promise((resolve, reject) => {
    stream.error ?
      reject(stream.error) :
      resolve({ acks, nak, packfile, progress, shallows, unshallows })
  });
}




/**
 * @fileoverview Command for creating Git packfiles from loose objects
 * 
 * This module provides functionality to create compressed packfiles from a collection
 * of Git objects. Packfiles are an efficient storage format that reduces repository
 * size by compressing objects and eliminating duplicate data. The command processes
 * object IDs, retrieves their content, applies delta compression, and generates a
 * single packfile with accompanying checksum validation for repository optimization
 * and network transfer efficiency.
 * 
 * @module commands/pack
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { deflate } from "../utils/deflate.ts";
import { join } from "../utils/join.ts";
import { padHex } from "../utils/pad-hex.ts";
import { _readObject as readObject } from "../storage/read-object.ts";
import { types } from "./types.ts";

import type { Cache, FsInterface } from "../types.ts";

interface PackOptions {
  cache: Cache;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  oids: string[];
}

interface WriteObjectOptions {
  object: Uint8Array;
  stype: string;
}

/*** Deno-compatible Hash class using crypto.subtle ***/
class Hash {
  private chunks: Uint8Array[] = [];

  update(data: Uint8Array): this {
    this.chunks.push(data);
    return this;
  }

  async digest(): Promise<ArrayBuffer> {
    /*** Concatenate all chunks ***/
    const totalLength = this.chunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0
    );

    const combined = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of this.chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    /*** Use crypto.subtle to compute SHA-1 ***/
    return await crypto.subtle.digest("SHA-1", combined);
  }
}



//// export

export async function _pack({
  cache,
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  oids
}: PackOptions): Promise<Uint8Array[]> {
  const hash = new Hash();
  const outputStream: Uint8Array[] = [];

  function write(chunk: string | Uint8Array, enc?: string): void {
    let buff: Uint8Array;

    if (typeof chunk === "string") {
      if (enc === "hex") {
        buff = new Uint8Array(chunk.length / 2);

        for (let i = 0; i < chunk.length; i += 2) {
          buff[i / 2] = parseInt(chunk.substr(i, 2), 16);
        }
      } else {
        buff = new TextEncoder().encode(chunk);
      }
    } else {
      buff = chunk;
    }

    outputStream.push(buff);
    hash.update(buff);
  }

  async function writeObject({ object, stype }: WriteObjectOptions): Promise<void> {
    /*** Object type is encoded in bits 654 ***/
    const type = types[stype as keyof typeof types];

    /*** The length encoding gets complicated. ***/
    let length = object.length;

    /*** Whether the next byte is part of the variable-length encoded number
    is encoded in bit 7 ***/
    let multibyte = length > 0b1111 ?
      0b10000000 :
      0b0;

    /*** Last four bits of length is encoded in bits 3210 ***/
    const lastFour = length & 0b1111;

    /*** Discard those bits ***/
    length = length >>> 4;

    /*** The first byte is then (1-bit multibyte?), (3-bit type), (4-bit least sig 4-bits of length) ***/
    const byte = (multibyte | type | lastFour).toString(16);
    write(byte, "hex");

    /*** Now we keep chopping away at length 7-bits at a time until its zero,
    writing out the bytes in what amounts to little-endian order. ***/
    while (multibyte) {
      multibyte = length > 0b01111111 ?
        0b10000000 :
        0b0;

      const byteValue = multibyte | (length & 0b01111111);
      write(padHex(2, byteValue), "hex");
      length = length >>> 7;
    }

    /*** Lastly, we can compress and write the object. ***/
    const deflated = await deflate(object);
    write(deflated);
  }

  write("PACK");
  write("00000002", "hex");

  /*** Write a 4 byte (32-bit) int ***/
  write(padHex(8, oids.length), "hex");

  for (const oid of oids) {
    const { object, type } = await readObject({ cache, fs, gitdir, oid });
    await writeObject({ object, stype: type! });
  }

  /*** Write SHA1 checksum ***/
  const digest = await hash.digest();
  outputStream.push(new Uint8Array(digest));

  return outputStream;
}

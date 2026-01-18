// My version of git-list-pack - roughly 15x faster than the original
// It’s used slightly differently - instead of returning a through stream it wraps a stream.
// (I tried to make it API identical, but that ended up being 2x slower than this version.)



//// util

import { InternalError } from "../errors/internal.ts";
import { StreamReader } from "../utils/stream-reader.ts";

interface PackEntry {
  data: Uint8Array;
  end: number;
  num: number;
  offset: number;
  ofs?: number;
  reference?: Uint8Array;
  type: number;
}

interface ParsedHeader {
  length: number;
  ofs?: number;
  reference?: Uint8Array;
  type: number;
}



//// export

export async function listpack(stream: AsyncIterable<Uint8Array>, onData: (entry: PackEntry) => Promise<void> | void): Promise<void> {
  const reader = new StreamReader(stream);
  const PACK = await reader.read(4);

  if (!PACK)
    throw new InternalError("Unexpected EOF reading PACK header");

  const packStr = new TextDecoder().decode(PACK);

  if (packStr !== "PACK")
    throw new InternalError(`Invalid PACK header "${packStr}"`);

  const versionBuf = await reader.read(4);

  if (!versionBuf)
    throw new InternalError("Unexpected EOF reading version");

  const version = new DataView(
    versionBuf.buffer,
    versionBuf.byteOffset,
    versionBuf.byteLength
  ).getUint32(0, false);

  if (version !== 2)
    throw new InternalError(`Invalid packfile version: ${version}`);

  const numObjectsBuf = await reader.read(4);

  if (!numObjectsBuf)
    throw new InternalError("Unexpected EOF reading numObjects");

  let numObjects = new DataView(
    numObjectsBuf.buffer,
    numObjectsBuf.byteOffset,
    numObjectsBuf.byteLength
  ).getUint32(0, false);

  /*** If (for some godforsaken reason) this is an empty packfile, abort now. ***/
  if (numObjects < 1)
    return;

  while (!reader.eof() && numObjects--) {
    const offset = reader.tell();
    const { length, ofs, reference, type } = await parseHeader(reader);

    const inflator = {
      err: null,
      push: () => {},
      result: null,
      strm: { avail_in: 0 }
    } as any;

    while (!inflator.result) {
      const chunk = await reader.chunk();

      if (!chunk)
        break;

      inflator.push(chunk, false);

      if (inflator.err)
        throw new InternalError(`Pako error: ${inflator.msg}`);

      if (inflator.result) {
        if (inflator.result.length !== length)
          throw new InternalError(`Inflated object size is different from that stated in packfile.`);

        /*** Backtrack parser to where deflated data ends ***/
        await reader.undo();
        await reader.read(chunk.length - inflator.strm.avail_in);

        const end = reader.tell();

        await onData({
          data: new Uint8Array(inflator.result),
          end,
          num: numObjects,
          offset,
          ofs: ofs || 0,
          reference,
          type
        } as any);
      }
    }
  }
}



//// helper

async function parseHeader(reader: StreamReader): Promise<ParsedHeader> {
  /*** Object type is encoded in bits 654 ***/
  let byte = await reader.byte();

  if (byte === undefined)
    throw new InternalError("Unexpected EOF reading header");

  const type = (byte >> 4) & 0b111;

  /*** The length encoding get complicated.
  Last four bits of length is encoded in bits 3210 ***/
  let length = byte & 0b1111;

  /*** Whether the next byte is part of the variable-length encoded number
  is encoded in bit 7 ***/
  if (byte & 0b10000000) {
    let shift = 4;

    do {
      byte = await reader.byte();

      if (byte === undefined)
        throw new InternalError("Unexpected EOF reading length");

      length |= (byte & 0b01111111) << shift;
      shift += 7;
    } while (byte & 0b10000000);
  }

  /*** Handle deltified objects ***/
  let ofs: number | undefined;
  let reference: Uint8Array | undefined;

  if (type === 6) {
    let shift = 0;
    ofs = 0;
    const bytes: number[] = [];

    do {
      byte = await reader.byte();

      if (byte === undefined)
        throw new InternalError("Unexpected EOF reading ofs-delta");

      ofs |= (byte & 0b01111111) << shift;
      shift += 7;
      bytes.push(byte);
    } while (byte & 0b10000000);

    reference = new Uint8Array(bytes);
  }

  if (type === 7) {
    const buf = await reader.read(20);

    if (!buf)
      throw new InternalError("Unexpected EOF reading ref-delta");

    reference = buf;
  }

  return { length, ofs: ofs || 0, reference, type } as any;
}

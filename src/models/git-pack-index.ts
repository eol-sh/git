


//// import

import crc32 from "crc-32";

//// util

import { applyDelta } from "../utils/apply-delta.ts";
import { BufferCursor } from "../utils/buffer-cursor.ts";
import { GitObject } from "../models/git-object.ts";
import { inflate } from "../utils/inflate.ts";
import { InternalError } from "../errors/internal.ts";
import { listpack } from "../utils/git-list-pack.ts";
import { shasum } from "../utils/shasum.ts";

type GitObjectType = "blob" | "commit" | "tag" | "tree";

type PackObjectType =
  | GitObjectType
  | "ofs-delta"
  | "ref-delta"
  | "ofs_delta"
  | "ref_delta";

interface LoadOptions {
  pack: Promise<Uint8Array> | Uint8Array;
}

interface PackObject {
  crc?: number;
  end?: number;
  offset: number;
  oid?: string;
  type: PackObjectType;
}

interface ProgressEvent {
  loaded: number;
  phase: string;
  total: number;
}

interface ReadOptions {
  oid: string;
}

interface ReadResult {
  object: Uint8Array;
  type: GitObjectType;
}

interface ReadSliceOptions {
  start: number;
}

interface ReadSliceResult {
  format: "content";
  object: Uint8Array;
  type: GitObjectType;
}

interface FromIdxOptions {
  getExternalRefDelta?: (oid: string) => Promise<ReadResult>;
  idx: Uint8Array;
}

interface FromPackOptions {
  getExternalRefDelta?: (oid: string) => Promise<ReadResult>;
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
  pack: Uint8Array;
}

interface GitPackIndexOptions {
  crcs: Record<string, number>;
  getExternalRefDelta?: (oid: string) => Promise<ReadResult>;
  hashes: string[];
  offsets: Map<string, number>;
  pack?: Promise<Uint8Array>;
  packfileSha: string;
}



//// export

export class GitPackIndex {
  crcs!: Record<string, number>;
  externalReadDepth: number = 0;
  getExternalRefDelta?: (oid: string) => Promise<ReadResult>;
  hashes!: string[];
  offsetCache: Record<number, ReadSliceResult>;
  offsets!: Map<string, number>;
  pack?: Promise<Uint8Array>;
  packfileSha!: string;
  readDepth: number = 0;

  constructor(options: GitPackIndexOptions) {
    Object.assign(this, options);
    this.offsetCache = {};
  }

  static fromIdx({ getExternalRefDelta, idx }: FromIdxOptions): Promise<GitPackIndex | undefined> {
    const reader = new BufferCursor(idx);
    const magic = Array
      .from(reader.slice(4), (byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    /*** Check for IDX v2 magic number ***/
    if (magic !== "ff744f63")
      return Promise.resolve(undefined);

    const version = reader.readUInt32BE();

    if (version !== 2)
      throw new InternalError(`Unable to read version ${version} packfile IDX. (Only version 2 supported)`);

    if (idx.byteLength > 2048 * 1024 * 1024)
      throw new InternalError("To keep implementation simple, I haven’t implemented the layer 5 feature needed to support packfiles > 2GB in size.");

    /*** Skip over fanout table ***/
    reader.seek(reader.tell() + 4 * 255);

    /*** Get hashes ***/
    const hashes: string[] = [];
    const size = reader.readUInt32BE();

    for (let i = 0; i < size; i++) {
      const hash = Array
        .from(reader.slice(20), (byte) => byte.toString(16).padStart(2, "0"))
        .join("");

      hashes[i] = hash;
    }

    reader.seek(reader.tell() + 4 * size);

    /*** Skip over CRCs ***/
    /*** Get offsets ***/
    const offsets = new Map<string, number>();

    for (let i = 0; i < size; i++) {
      offsets.set(hashes[i], reader.readUInt32BE());
    }

    const packfileSha = Array
      .from(reader.slice(20), (byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    return Promise.resolve(new GitPackIndex({
      crcs: {},
      ...(getExternalRefDelta ? { getExternalRefDelta } : {}),
      hashes,
      offsets,
      packfileSha
    }));
  }

  static async fromPack({ getExternalRefDelta, onProgress, pack }: FromPackOptions): Promise<GitPackIndex> {
    const listpackTypes: Record<number, PackObjectType> = {
      1: "commit",
      2: "tree",
      3: "blob",
      4: "tag",
      6: "ofs-delta",
      7: "ref-delta"
    };

    const offsetToObject: Record<number, PackObject> = {};

    /*** Older packfiles do NOT use the shasum of the pack itself, so it is recommended to just use whatever bytes are in the trailer.
    Source: https://github.com/git/git/commit/1190a1acf800acdcfd7569f87ac1560e2d077414 ***/
    const packfileSha = Array
      .from(pack.slice(-20), (byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    const crcs: Record<string, number> = {};
    const hashes: string[] = [];
    const offsets = new Map<string, number>();
    let lastPercent: number | null = null;
    let totalObjectCount: number | null = null;

    async function* packIterator() {
      yield pack;
    }

    await listpack(packIterator(), async({ num, offset, type }) => {
      if (totalObjectCount === null)
        totalObjectCount = num;

      const percent = Math.floor(((totalObjectCount - num) * 100) / totalObjectCount);

      if (percent !== lastPercent) {
        if (onProgress) {
          await onProgress({
            loaded: totalObjectCount - num,
            phase: "Receiving objects",
            total: totalObjectCount
          } as ProgressEvent);
        }
      }

      lastPercent = percent;

      /*** Change type from a number to a meaningful string ***/
      const typeString = listpackTypes[type as number];
      const finalType = typeString as PackObjectType;

      if (["commit", "tree", "blob", "tag"].includes(finalType)) {
        offsetToObject[offset] = {
          offset,
          type: finalType
        };
      } else if (finalType === "ofs-delta") {
        offsetToObject[offset] = {
          offset,
          type: finalType
        };
      } else if (finalType === "ref-delta") {
        offsetToObject[offset] = {
          offset,
          type: finalType
        };
      }
    });

    /*** We need to know the lengths of the slices to compute the CRCs. ***/
    const offsetArray = Object.keys(offsetToObject).map(Number);

    for (const [i, start] of offsetArray.entries()) {
      const end = i + 1 === offsetArray.length ?
        pack.byteLength - 20 :
        offsetArray[i + 1];

      const o = offsetToObject[start];
      const crc = crc32.buf(pack.slice(start, end) as any) >>> 0;

      o.end = end;
      o.crc = crc;
    }

    /*** We don’t have the hashes yet. But we can generate them using the .readSlice function! ***/
    const p = new GitPackIndex({
      crcs,
      ...(getExternalRefDelta ? { getExternalRefDelta } : {}),
      hashes,
      offsets,
      pack: Promise.resolve(pack),
      packfileSha
    });

    /*** Resolve deltas and compute the oids ***/
    lastPercent = null;
    const objectsByDepth = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    let count = 0;

    for (const offset in offsetToObject) {
      const offsetNum = Number(offset);
      const percent = Math.floor((count * 100) / totalObjectCount!);

      if (percent !== lastPercent) {
        if (onProgress) {
          await onProgress({
            loaded: count,
            phase: "Resolving deltas",
            total: totalObjectCount!
          } as ProgressEvent);
        }
      }

      count++;
      lastPercent = percent;
      const o = offsetToObject[offsetNum];

      if (o.oid)
        continue;

      try {
        p.readDepth = 0;
        p.externalReadDepth = 0;

        const { object, type } = await p.readSlice({ start: offsetNum });
        objectsByDepth[p.readDepth] += 1;

        const oid = await shasum(GitObject.wrap({ type, object }));
        o.oid = oid;
        hashes.push(oid);
        offsets.set(oid, offsetNum);
        crcs[oid] = o.crc!;
      } catch {
        continue;
      }
    }

    hashes.sort();
    return p;
  }



  load({ pack }: LoadOptions): Promise<void> {
    this.pack = pack instanceof Promise ?
      pack :
      Promise.resolve(pack);

    return Promise.resolve();
  }

  async read({ oid }: ReadOptions): Promise<ReadResult> {
    if (!this.offsets.get(oid)) {
      if (this.getExternalRefDelta) {
        this.externalReadDepth++;
        return this.getExternalRefDelta(oid);
      } else {
        throw new InternalError(`Could not read object ${oid} from packfile`);
      }
    }

    const start = this.offsets.get(oid)!;
    const result = await this.readSlice({ start });

    return {
      object: result.object,
      type: result.type
    };
  }

  async readSlice({ start }: ReadSliceOptions): Promise<ReadSliceResult> {
    if (this.offsetCache[start])
      return Object.assign({}, this.offsetCache[start]);

    this.readDepth++;

    const types: Record<number, PackObjectType> = {
      0b0010000: "commit",
      0b0100000: "tree",
      0b0110000: "blob",
      0b1000000: "tag",
      0b1100000: "ofs_delta",
      0b1110000: "ref_delta"
    };

    if (!this.pack)
      throw new InternalError("Tried to read from a GitPackIndex with no packfile loaded into memory");

    const packData = await this.pack;
    const raw = packData.slice(start);
    const reader = new BufferCursor(raw);
    const byte = reader.readUInt8();

    /*** Object type is encoded in bits 654 ***/
    const btype = byte & 0b1110000;
    const type = types[btype];

    if (type === undefined)
      throw new InternalError("Unrecognized type: 0b" + btype.toString(2));

    /*** The length encoding get complicated.
    Last four bits of length is encoded in bits 3210 ***/
    const lastFour = byte & 0b1111;
    let length = lastFour;

    /*** Whether the next byte is part of the variable-length encoded number is encoded in bit 7 ***/
    const multibyte = byte & 0b10000000;

    if (multibyte)
      length = otherVarIntDecode(reader, lastFour);

    let base: Uint8Array | null = null;
    let object: Uint8Array | null = null;
    let actualType: GitObjectType = type as GitObjectType;

    /*** Handle deltified objects ***/
    if (type === "ofs_delta") {
      const offset = decodeVarInt(reader);
      const baseOffset = start - offset;
      const baseResult = await this.readSlice({ start: baseOffset });

      base = baseResult.object;
      actualType = baseResult.type;
    }

    if (type === "ref_delta") {
      const oid = Array.from(
        reader.slice(20),
        (byte) => byte.toString(16).padStart(2, "0")
      ).join("");

      const refResult = await this.read({ oid });
      base = refResult.object;
      actualType = refResult.type;
    }

    /*** Handle undeltified objects ***/
    const buffer = raw.slice(reader.tell());
    object = new Uint8Array(await inflate(buffer));

    /*** Assert that the object length is as expected. ***/
    if (object.byteLength !== length)
      throw new InternalError(`Packfile told us object would have length ${length} but it had length ${object.byteLength}`);

    if (base)
      object = new Uint8Array(applyDelta(object, base));

    const result: ReadSliceResult = {
      format: "content",
      object,
      type: actualType
    };

    /*** Cache the result based on depth. ***/
    if (this.readDepth > 3) {
      /*** hand tuned for speed / memory usage tradeoff ***/
      this.offsetCache[start] = result;
    }

    return result;
  }

  async toBuffer(): Promise<Uint8Array> {
    const buffers: Uint8Array[] = [];

    const write = (str: string, encoding: string) => {
      if (encoding === "hex") {
        const bytes = new Uint8Array(str.length / 2);

        for (let i = 0; i < str.length; i += 2) {
          bytes[i / 2] = parseInt(str.slice(i, i + 2), 16);
        }

        buffers.push(bytes);
      } else {
        buffers.push(new TextEncoder().encode(str));
      }
    };

    /*** Write out IDX v2 magic number ***/
    write("ff744f63", "hex");

    /*** Write out version number 2 ***/
    write("00000002", "hex");

    /*** Write fanout table ***/
    const fanoutBuffer = new Uint8Array(256 * 4);
    const fanoutCursor = new BufferCursor(fanoutBuffer);

    for (let i = 0; i < 256; i++) {
      let count = 0;

      for (const hash of this.hashes) {
        if (parseInt(hash.slice(0, 2), 16) <= i)
          count++;
      }

      fanoutCursor.writeUInt32BE(count);
    }

    buffers.push(fanoutBuffer);

    /*** Write out hashes ***/
    for (const hash of this.hashes) {
      write(hash, "hex");
    }

    /*** Write out crcs ***/
    const crcsBuffer = new Uint8Array(this.hashes.length * 4);
    const crcsCursor = new BufferCursor(crcsBuffer);

    for (const hash of this.hashes) {
      crcsCursor.writeUInt32BE(this.crcs[hash]);
    }

    buffers.push(crcsBuffer);

    /*** Write out offsets ***/
    const offsetsBuffer = new Uint8Array(this.hashes.length * 4);
    const offsetsCursor = new BufferCursor(offsetsBuffer);

    for (const hash of this.hashes) {
      offsetsCursor.writeUInt32BE(this.offsets.get(hash)!);
    }

    buffers.push(offsetsBuffer);

    /*** Write out packfile checksum ***/
    write(this.packfileSha, "hex");

    /*** Write out shasum ***/
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const totalBuffer = new Uint8Array(totalLength);
    let offset = 0;

    for (const buf of buffers) {
      totalBuffer.set(buf, offset);
      offset += buf.length;
    }

    const sha = await shasum(totalBuffer);
    const shaBuffer = new Uint8Array(20);

    for (let i = 0; i < 20; i++) {
      shaBuffer[i] = parseInt(sha.slice(i * 2, i * 2 + 2), 16);
    }

    const result = new Uint8Array(totalBuffer.length + shaBuffer.length);
    result.set(totalBuffer, 0);
    result.set(shaBuffer, totalBuffer.length);

    return result;
  }

  unload(): Promise<void> {
    this.pack = undefined as any;
    return Promise.resolve();
  }
}



//// helper

function decodeVarInt(reader: BufferCursor): number {
  const bytes: number[] = [];
  let byte = 0;
  let multibyte = 0;

  do {
    byte = reader.readUInt8();
    /*** We keep bits 6543210 ***/
    const lastSeven = byte & 0b01111111;
    bytes.push(lastSeven);
    /*** Whether the next byte is part of the variable-length encoded number
    is encoded in bit 7 ***/
    multibyte = byte & 0b10000000;
  } while (multibyte);

  /*** Now that all the bytes are in big-endian order,
  alternate shifting the bits left by 7 and OR-ing the next byte.
  And... do a weird increment-by-one thing that I don’t quite understand. ***/
  return bytes.reduce((a, b) => ((a + 1) << 7) | b, -1);
}

/*** I’m pretty much copying this one from the git C source code, because it makes no sense. ***/
function otherVarIntDecode(reader: BufferCursor, startWith: number): number {
  let result = startWith;
  let shift = 4;
  let byte = 0;

  do {
    byte = reader.readUInt8();
    result |= (byte & 0b01111111) << shift;
    shift += 7;
  } while (byte & 0b10000000);

  return result;
}

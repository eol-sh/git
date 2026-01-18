


//// util

import { BufferCursor } from "../utils/buffer-cursor.ts";
import { comparePath } from "../utils/compare-path.ts";
import { InternalError } from "../errors/internal.ts";
import { normalizeStats } from "../utils/normalize-stats.ts";
import { shasum } from "../utils/shasum.ts";
import { UnsafeFilepathError } from "../errors/unsafe-filepath.ts";

interface CacheEntryFlags {
  assumeValid: boolean;
  extended: boolean;
  intentToAdd?: boolean;  /*** Extended flag ***/
  nameLength: number;
  skipWorktree?: boolean; /*** Extended flag ***/
  stage: number;
}

interface CacheEntry {
  ctimeNanoseconds: number;
  ctimeSeconds: number;
  dev: number;
  flags: CacheEntryFlags;
  gid: number;
  ino: number;
  mode: number;
  mtimeNanoseconds: number;
  mtimeSeconds: number;
  oid: string;
  path: string;
  size: number;
  stages: CacheEntry[];
  uid: number;
}

interface FileStats {
  ctime?: Date;
  ctimeMs?: number;
  ctimeNanoseconds?: number;
  ctimeSeconds?: number;
  dev: number;
  gid: number;
  ino: number;
  mode: number;
  mtime?: Date;
  mtimeMs?: number;
  mtimeNanoseconds?: number;
  mtimeSeconds?: number;
  size: number;
  uid: number;
}

interface IndexDeleteOptions {
  filepath: string;
}

interface IndexHasOptions {
  filepath: string;
}

interface IndexInsertOptions {
  filepath: string;
  oid: string;
  stage?: number;
  stats?: FileStats;
}



//// export

export class GitIndex {
  // private _dirty: boolean; /*** Used to determine if index needs to be saved to filesystem **/
  private _entries: Map<string, CacheEntry>;
  private _unmergedPaths: Set<string>;

  constructor(entries?: Map<string, CacheEntry> | null, unmergedPaths?: Set<string>) {
    // this._dirty = false;
    this._entries = entries || new Map();
    this._unmergedPaths = unmergedPaths || new Set();
  }

  private _addEntry(entry: CacheEntry): void {
    if (entry.flags.stage === 0) {
      entry.stages = [entry];

      this._entries.set(entry.path, entry);
      this._unmergedPaths.delete(entry.path);
    } else {
      let existingEntry = this._entries.get(entry.path);

      if (!existingEntry) {
        this._entries.set(entry.path, entry);
        existingEntry = entry;
      }

      existingEntry.stages[entry.flags.stage] = entry;
      this._unmergedPaths.add(entry.path);
    }
  }

  static _entryToBuffer(entry: CacheEntry): Uint8Array {
    const bpath = new TextEncoder().encode(entry.path);
    /*** the fixed length + the filename + at least one null char => align by 8 ***/
    const length = Math.ceil((62 + bpath.length + 1) / 8) * 8;
    const written = new Uint8Array(length);
    const writer = new BufferCursor(written);
    const stat = normalizeStats(entry);

    writer.writeUInt32BE(stat.ctimeSeconds);
    writer.writeUInt32BE(stat.ctimeNanoseconds);
    writer.writeUInt32BE(stat.mtimeSeconds);
    writer.writeUInt32BE(stat.mtimeNanoseconds);
    writer.writeUInt32BE(stat.dev);
    writer.writeUInt32BE(stat.ino);
    writer.writeUInt32BE(stat.mode);
    writer.writeUInt32BE(stat.uid);
    writer.writeUInt32BE(stat.gid);
    writer.writeUInt32BE(stat.size);

    /*** Write oid as hex bytes ***/
    const oidBytes = new Uint8Array(20);

    for (let i = 0; i < 20; i++) {
      oidBytes[i] = parseInt(entry.oid.slice(i * 2, i * 2 + 2), 16);
    }

    writer.copy(oidBytes);
    writer.writeUInt16BE(renderCacheEntryFlags(entry));
    writer.write(entry.path, bpath.length, "utf8");

    return written;
  }

  static from(buffer: Uint8Array | null): Promise<GitIndex> {
    if (buffer instanceof Uint8Array || (buffer as any) instanceof ArrayBuffer)
      return GitIndex.fromBuffer(new Uint8Array(buffer!));
    else if (buffer === null)
      return Promise.resolve(new GitIndex(null));
    else
      throw new InternalError("invalid type passed to GitIndex.from");
  }

  static async fromBuffer(buffer: Uint8Array): Promise<GitIndex> {
    if (buffer.length === 0)
      throw new InternalError("Index file is empty (.git/index)");

    const index = new GitIndex();
    const reader = new BufferCursor(buffer);
    const magic = reader.toString("utf8", 4);

    if (magic !== "DIRC")
      throw new InternalError(`Invalid dircache magic file number: ${magic}`);

    /*** Verify shasum after we ensured that the file has a magic number ***/
    const shaComputed = await shasum(buffer.slice(0, -20));

    const shaClaimed = Array.from(
      buffer.slice(-20),
      (byte) => byte.toString(16).padStart(2, "0")
    ).join("");

    if (shaClaimed !== shaComputed)
      throw new InternalError(`Invalid checksum in GitIndex buffer: expected ${shaClaimed} but saw ${shaComputed}`);

    const version = reader.readUInt32BE();

    if (version !== 2)
      throw new InternalError(`Unsupported dircache version: ${version}`);

    const numEntries = reader.readUInt32BE();
    let i = 0;

    while (!reader.eof() && i < numEntries) {
      const entry: CacheEntry = {} as CacheEntry;

      entry.ctimeSeconds = reader.readUInt32BE();
      entry.ctimeNanoseconds = reader.readUInt32BE();
      entry.mtimeSeconds = reader.readUInt32BE();
      entry.mtimeNanoseconds = reader.readUInt32BE();
      entry.dev = reader.readUInt32BE();
      entry.ino = reader.readUInt32BE();
      entry.mode = reader.readUInt32BE();
      entry.uid = reader.readUInt32BE();
      entry.gid = reader.readUInt32BE();
      entry.size = reader.readUInt32BE();

      entry.oid = Array.from(
        reader.slice(20),
        (byte) => byte.toString(16).padStart(2, "0")
      ).join("");

      const flags = reader.readUInt16BE();
      entry.flags = parseCacheEntryFlags(flags);

      /*** Handle extended flags for version 3 ***/
      if (version >= 3 && entry.flags.extended) {
        const extendedFlags = reader.readUInt16BE();

        entry.flags.skipWorktree = !!(extendedFlags & 0x4000);
        entry.flags.intentToAdd = !!(extendedFlags & 0x2000);
      }

      /*** Handle pathnames larger than 12 bits (0xFFF) ***/
      let pathlength = entry.flags.nameLength;

      if (pathlength === 0xFFF) {
        /*** Path name is longer than 12 bits, read null-terminated path ***/
        const startPos = reader.tell();
        const nullPos = buffer.indexOf(0, startPos);

        if (nullPos === -1)
          throw new InternalError("Could not find null terminator for long path name");

        pathlength = nullPos - startPos;
      } else {
        /*** Standard path length, but verify it matches the actual string ***/
        const actualPathlength = buffer.indexOf(0, reader.tell() + 1) - reader.tell();

        if (pathlength === 0)
          pathlength = actualPathlength;

        if (pathlength < 1)
          throw new InternalError(`Got a path length of: ${pathlength}`);
      }

      entry.path = reader.toString("utf8", pathlength);

      /*** Prevent malicious paths like "..\foo" ***/
      if (entry.path.includes("..\\") || entry.path.includes("../"))
        throw new UnsafeFilepathError(entry.path);

      /*** The next bit is awkward. We expect 1 to 8 null characters
      such that the total size of the entry is a multiple of 8 bits.
      (Hence subtract 12 bytes for the header.) ***/
      let padding = 8 - ((reader.tell() - 12) % 8);

      if (padding === 0)
        padding = 8;

      while (padding--) {
        const tmp = reader.readUInt8();

        if (tmp !== 0)
          throw new InternalError(`Expected 1-8 null characters but got "${tmp}" after ${entry.path}`);
        else if (reader.eof())
          throw new InternalError("Unexpected end of file");
      }

      /*** end of awkward part ***/
      entry.stages = [];
      index._addEntry(entry);
      i++;
    }

    return index;
  }



  *[Symbol.iterator](): Iterator<CacheEntry> {
    for (const entry of this.entries) {
      yield entry;
    }
  }

  clear(): void {
    this._entries.clear();
    // this._dirty = true;
  }

  delete({ filepath }: IndexDeleteOptions): void {
    if (this._entries.has(filepath)) {
      this._entries.delete(filepath);
    } else {
      for (const key of this._entries.keys()) {
        if (key.startsWith(filepath + "/"))
          this._entries.delete(key);
      }
    }

    if (this._unmergedPaths.has(filepath))
      this._unmergedPaths.delete(filepath);

    // this._dirty = true;
  }

  get entries(): CacheEntry[] {
    return [...this._entries.values()].sort(comparePath);
  }

  get entriesFlat(): CacheEntry[] {
    return [...this.entries].flatMap((entry) => {
      return entry.stages.length > 1 ?
        entry.stages.filter((x) => x) :
        entry;
    });
  }

  get entriesMap(): Map<string, CacheEntry> {
    return this._entries;
  }

  has({ filepath }: IndexHasOptions): boolean {
    return this._entries.has(filepath);
  }

  insert({ filepath, oid, stage = 0, stats }: IndexInsertOptions): void {
    let normalizedStats = stats;

    if (!normalizedStats) {
      normalizedStats = {
        ctimeNanoseconds: 0,
        ctimeSeconds: 0,
        dev: 0,
        gid: 0,
        ino: 0,
        mode: 0,
        mtimeNanoseconds: 0,
        mtimeSeconds: 0,
        size: 0,
        uid: 0
      };
    }

    const processedStats = normalizeStats(normalizedStats);
    const bfilepath = new TextEncoder().encode(filepath);

    const entry: CacheEntry = {
      ctimeNanoseconds: processedStats.ctimeNanoseconds,
      ctimeSeconds: processedStats.ctimeSeconds,
      dev: processedStats.dev,
      flags: {
        assumeValid: false,
        extended: false,
        nameLength: bfilepath.length < 0xfff ?
          bfilepath.length :
          0xfff,
        stage
      },
      gid: processedStats.gid,
      ino: processedStats.ino,
      /*** We provide a fallback value for `mode` here because not all fs
      implementations assign it, but we use it in GitTree.
      "100644" is for a "regular non-executable file" ***/
      mode: processedStats.mode || 0o100644,
      mtimeNanoseconds: processedStats.mtimeNanoseconds,
      mtimeSeconds: processedStats.mtimeSeconds,
      oid,
      path: filepath,
      size: processedStats.size,
      stages: [],
      uid: processedStats.uid
    };

    this._addEntry(entry);
    // this._dirty = true;
  }

  render(): string {
    return this.entries
      .map((entry) => `${entry.mode.toString(8)} ${entry.oid}    ${entry.path}`)
      .join("\n");
  }

  async toObject(): Promise<Uint8Array> {
    const header = new Uint8Array(12);
    const writer = new BufferCursor(header);

    writer.write("DIRC", 4, "utf8");
    writer.writeUInt32BE(2);
    writer.writeUInt32BE(this.entriesFlat.length);

    const entryBuffers: Uint8Array[] = [];
    let offset = 0;

    for (const entry of this.entries) {
      entryBuffers.push(GitIndex._entryToBuffer(entry));

      if (entry.stages.length > 1) {
        for (const stage of entry.stages) {
          if (stage && stage !== entry)
            entryBuffers.push(GitIndex._entryToBuffer(stage));
        }
      }
    }

    const body = new Uint8Array(entryBuffers.reduce((sum, buf) => sum + buf.length, 0));

    for (const buf of entryBuffers) {
      body.set(buf, offset);
      offset += buf.length;
    }

    const main = new Uint8Array(header.length + body.length);

    main.set(header, 0);
    main.set(body, header.length);

    const sum = await shasum(main);
    const sumBytes = new Uint8Array(20);

    for (let i = 0; i < 20; i++) {
      sumBytes[i] = parseInt(sum.slice(i * 2, i * 2 + 2), 16);
    }

    const result = new Uint8Array(main.length + sumBytes.length);

    result.set(main, 0);
    result.set(sumBytes, main.length);

    return result;
  }

  get unmergedPaths(): string[] {
    return [...this._unmergedPaths];
  }
}



//// helper

/*** Extract 1-bit assume-valid, 1-bit extended flag, 2-bit merge state flag, 12-bit path length flag ***/
function parseCacheEntryFlags(bits: number): CacheEntryFlags {
  return {
    assumeValid: Boolean(bits & 0b1000000000000000),
    extended: Boolean(bits & 0b0100000000000000),
    nameLength: bits & 0b0000111111111111,
    stage: (bits & 0b0011000000000000) >> 12
  };
}

function renderCacheEntryFlags(entry: CacheEntry): number {
  const flags = entry.flags;
  /*** 1-bit extended flag (must be zero in version 2) ***/
  flags.extended = false;
  /*** 12-bit name length if the length is less than 0xFFF; otherwise 0xFFF
  is stored in this field. ***/
  flags.nameLength = Math.min(
    new TextEncoder().encode(entry.path).length,
    0xfff
  );

  return (
    (flags.assumeValid ? 0b1000000000000000 : 0) +
    (flags.extended ? 0b0100000000000000 : 0) +
    ((flags.stage & 0b11) << 12) +
    (flags.nameLength & 0b111111111111)
  );
}

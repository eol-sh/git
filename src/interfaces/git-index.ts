


//// export

export interface CacheEntryFlags {
  assumeValid: boolean;
  extended: boolean;
  nameLength: number;
  stage: number;
}

export interface CacheEntry {
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

export interface IndexInsertOptions {
  filepath: string;
  oid: string;
  stats: {
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
  };
  stage?: number;
}

export interface GitIndexInterface {
  /*** Properties ***/
  readonly entries: CacheEntry[];
  readonly entriesFlat: CacheEntry[];
  readonly entriesMap: Map<string, CacheEntry>;
  readonly unmergedPaths: string[];

  /*** Methods ***/
  clear(): void;
  delete(options: { filepath: string }): void;
  has(filepath: string): boolean;
  insert(options: IndexInsertOptions): void;
  render(): Promise<{ entries: CacheEntry[] }>;
  toObject(): Promise<Uint8Array>;

  /*** Static methods (for the interface) ***/
  from?(buffer: Uint8Array | null): Promise<GitIndexInterface>;
  fromBuffer?(buffer: Uint8Array): Promise<GitIndexInterface>;
}




//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { compareStats } from "../utils/compare-stats.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitObject } from "./git-object.ts";
import { join } from "../utils/join.ts";
import { normalizeStats } from "../utils/normalize-stats.ts";
import { shasum } from "../utils/shasum.ts";

import type { FsInterface, WalkerEntry } from "../types.ts";

interface FileStats {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  mode: number;
  size: number;
}

interface GitWalkerFsOptions {
  cache?: Map<string, unknown>;
  dir: string;
  fs: FsInterface;
  gitdir: string;
}

interface NormalizedStats {
  ctimeNanoseconds: number;
  ctimeSeconds: number;
  dev: number;
  gid: number;
  ino: number;
  mode: number;
  mtimeNanoseconds: number;
  mtimeSeconds: number;
  size: number;
  uid: number;
}



//// export

export class GitWalkerFs {
  cache?: Map<string, unknown>;
  config: unknown = null;
  ConstructEntry: typeof WorkdirEntry;
  dir: string;
  fs: FsInterface;
  gitdir: string;

  constructor({ cache, dir, fs, gitdir }: GitWalkerFsOptions) {
    this.cache = cache || new Map();
    this.config = null;
    this.dir = dir;
    this.fs = fs;
    this.gitdir = gitdir;

    // deno-lint-ignore no-this-alias
    const walker = this;

    this.ConstructEntry = class extends WorkdirEntry {
      constructor(fullpath: string) {
        super(fullpath, walker);
      }
    };
  }

  async _getGitConfig(fs: FsInterface, gitdir: string): Promise<unknown> {
    if (this.config)
      return this.config;

    this.config = await GitConfigManager.get({ fs: adaptFsInterface(fs), gitdir });
    return this.config;
  }

  async content(entry: WorkdirEntry): Promise<Uint8Array | void> {
    if (entry._content === false) {
      const { dir, fs } = this;

      if ((await entry.type()) === "tree") {
        entry._content = undefined;
      } else {
        // const config = await this._getGitConfig(fs, gitdir);
        // const _autocrlf = await (config as any).get("core.autocrlf");
        const content = await fs.readFile(`${dir}/${entry._fullpath}`) as Uint8Array;

        /*** workaround for a BrowserFS edge case ***/
        entry._actualSize = content.length;

        if (entry._stat && (entry._stat as { size: number }).size === -1)
          (entry._stat as { size: number }).size = entry._actualSize;

        entry._content = new Uint8Array(content);
      }
    }

    return entry._content;
  }

  async mode(entry: WorkdirEntry): Promise<number> {
    if (entry._mode === false)
      await entry.stat();

    return entry._mode as number;
  }

  async oid(entry: WorkdirEntry): Promise<string | undefined> {
    if (entry._oid === false) {
      // deno-lint-ignore no-this-alias
      const self = this;
      const { cache, fs, gitdir } = this;
      let oid: string | undefined;

      /*** See if we can use the SHA1 hash in the index. ***/
      await GitIndexManager.acquire({ cache: cache || new Map(), fs: adaptFsInterface(fs), gitdir }, async function (index) {
        const stage = index.entriesMap.get(entry._fullpath);
        const stats = await entry.stat();
        const config = await self._getGitConfig(fs, gitdir);
        const filemode = await (config as any).get("core.filemode");
        const trustino = Deno.build.os !== "windows";

        if (!stage || compareStats(stats as any, stage, filemode, trustino)) {
          const content = await entry.content();

          if (content === undefined) {
            oid = undefined;
          } else {
            oid = await shasum(GitObject.wrap({ object: content, type: "blob" }));
            /*** Update the stats in the index so we will get a "cache hit" next time
            1) if we can (because the oid and mode are the same)
            2) and only if we need to (because other stats differ) ***/
            if (
              stage &&
              oid === stage.oid &&
              (!filemode || stats.mode === stage.mode) &&
              compareStats(stats as any, stage, filemode, trustino)
            ) {
              index.insert({
                filepath: entry._fullpath,
                oid,
                stats: stats as any
              });
            }
          }
        } else {
          /*** Use the index SHA1 rather than compute it ***/
          oid = stage.oid;
        }
      });

      entry._oid = oid;
    }

    return entry._oid;
  }

  async readdir(entry: WorkdirEntry): Promise<string[] | null> {
    const filepath = entry._fullpath;
    const { dir, fs } = this;
    const names = await fs.readdir(join(dir, filepath)) as string[];

    if (names === null)
      return null;

    return names.map((name) => join(filepath, name));
  }

  async stat(entry: WorkdirEntry): Promise<NormalizedStats> {
    if (entry._stat === false) {
      const { dir, fs } = this;

      const stat = await fs.lstat(`${dir}/${entry._fullpath}`) as unknown as
        | FileStats
        | null;

      if (!stat)
        throw new Error(`ENOENT: no such file or directory, lstat "${entry._fullpath}"`);

      let type: "blob" | "special" | "tree" = stat.isDirectory() ?
        "tree" :
        "blob";

      if (type === "blob" && !stat.isFile() && !stat.isSymbolicLink())
        type = "special";

      entry._type = type;
      const normalizedStat = normalizeStats(stat as any);
      entry._mode = normalizedStat.mode;

      /*** workaround for a BrowserFS edge case ***/
      if (normalizedStat.size === -1 && entry._actualSize)
        normalizedStat.size = entry._actualSize;

      entry._stat = normalizedStat;
    }

    return entry._stat;
  }

  async type(entry: WorkdirEntry): Promise<"blob" | "commit" | "special" | "tree"> {
    if (entry._type === false)
      await entry.stat();

    return entry._type as "blob" | "commit" | "special" | "tree";
  }
}



//// helper

class WorkdirEntry implements WalkerEntry {
  _actualSize?: number;
  _content: Uint8Array | undefined | false = false;
  _fullpath: string;
  _mode: number | false = false;
  _oid: string | undefined | false = false;
  _stat: NormalizedStats | false = false;
  _type: "blob" | "special" | "tree" | false = false;

  constructor(fullpath: string, private walker: GitWalkerFs) {
    this._fullpath = fullpath;
  }

  content(): Promise<Uint8Array | void> {
    return this.walker.content(this);
  }

  mode(): Promise<number> {
    return this.walker.mode(this);
  }

  async oid(): Promise<string> {
    const result = await this.walker.oid(this);
    return result || "";
  }

  stat(): Promise<Deno.FileInfo> {
    return Promise.resolve(this.walker.stat(this) as unknown as Deno.FileInfo);
  }

  type(): Promise<"blob" | "commit" | "special" | "tree"> {
    return this.walker.type(this);
  }
}

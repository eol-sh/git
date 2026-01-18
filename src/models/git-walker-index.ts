/**
 * @fileoverview git-walker-index model definition
 *
 * Defines the git-walker-index class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-walker-index.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { compareStrings } from "../utils/compare-strings.ts";
import { flatFileListToDirectoryStructure } from "../utils/flat-file-list-to-directory-structure.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { mode2type } from "../utils/mode2type.ts";
import { normalizeStats } from "../utils/normalize-stats.ts";

import type { Cache, FsInterface } from "../types.ts";

interface IndexInode {
  children?: IndexInode[];
  fullpath: string;
  metadata?: {
    mode: number;
    oid: string;
    [key: string]: unknown;
  };
  type: string;
}

interface StageEntryInterface {
  _fullpath: string;
  _mode: number | false;
  _oid: string | false;
  _stat: any | false | undefined;
  _type: string | false;
  content(): Promise<void>;
  mode(): Promise<number>;
  oid(): Promise<string>;
  stat(): Promise<any>;
  type(): Promise<string>;
}



//// export

export class GitWalkerIndex {
  ConstructEntry: new (fullpath: string) => StageEntryInterface;
  treePromise: Promise<Map<string, IndexInode>>;

  constructor({ cache, fs, gitdir }: { cache: Cache; fs: FsInterface; gitdir: string; }) {
    this.treePromise = GitIndexManager.acquire(
      { cache, fs: adaptFsInterface(fs), gitdir },
      (index) => {
        return Promise.resolve(flatFileListToDirectoryStructure(index.entries));
      }
    ) as any;

    // deno-lint-ignore no-this-alias
    const walker = this;

    this.ConstructEntry = class StageEntry implements StageEntryInterface {
      _fullpath: string;
      _mode: number | false;
      _oid: string | false;
      _stat: any | false | undefined;
      _type: string | false;

      constructor(fullpath: string) {
        this._fullpath = fullpath;
        this._mode = false;
        this._oid = false;
        this._stat = false;
        this._type = false;
      }

      content(): Promise<void> {
        return walker.content(this);
      }

      mode(): Promise<number> {
        return walker.mode(this);
      }

      oid(): Promise<string> {
        return walker.oid(this);
      }

      stat(): Promise<any> {
        return walker.stat(this);
      }

      type(): Promise<string> {
        return walker.type(this);
      }
    };
  }

  async content(_entry: StageEntryInterface): Promise<void> {
    /*** Cannot get content for an index entry ***/
  }

  async mode(entry: StageEntryInterface): Promise<number> {
    if (entry._mode === false)
      await entry.stat();

    return entry._mode as number;
  }

  async oid(entry: StageEntryInterface): Promise<string> {
    if (entry._oid === false) {
      const tree = await this.treePromise;
      const inode = tree.get(entry._fullpath);

      entry._oid = inode!.metadata!.oid;
    }

    return entry._oid as string;
  }

  async readdir(entry: StageEntryInterface): Promise<string[] | null> {
    const filepath = entry._fullpath;
    const tree = await this.treePromise;
    const inode = tree.get(filepath);

    if (!inode)
      return null;

    if (inode.type === "blob")
      return null;

    if (inode.type !== "tree")
      throw new Error(`ENOTDIR: not a directory, scandir "${filepath}"`);

    const names = inode.children!.map((inode) => inode.fullpath);
    names.sort(compareStrings);

    return names;
  }

  async stat(entry: StageEntryInterface): Promise<any> {
    if (entry._stat === false) {
      const tree = await this.treePromise;
      const inode = tree.get(entry._fullpath);

      if (!inode)
        throw new Error(`ENOENT: no such file or directory, lstat "${entry._fullpath}"`);

      const stats = inode.type === "tree" ?
        {} :
        normalizeStats(inode.metadata! as any);

      entry._type = inode.type === "tree" ?
        "tree" :
        mode2type((stats as any).mode);

      entry._mode = (stats as any).mode;

      if (inode.type === "tree")
        entry._stat = undefined;
      else
        entry._stat = stats as any;
    }

    return entry._stat as any;
  }

  async type(entry: StageEntryInterface): Promise<string> {
    if (entry._type === false)
      await entry.stat();

    return entry._type as string;
  }
}

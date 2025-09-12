


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitTree } from "../models/git-tree.ts";
import { join } from "../utils/join.ts";
import { normalizeMode } from "../utils/normalize-mode.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { _readObject as readObject } from "../storage/read-object.ts";
import { resolveTree } from "../utils/resolve-tree.ts";

import type { FsInterface, WalkerEntry } from "../types.ts";

interface GitWalkerRepoOptions {
  cache?: Map<string, unknown>;
  fs: FsInterface;
  gitdir: string;
  ref: string;
}

interface TreeEntryObject {
  mode: string;
  oid: string;
  path?: string;
  type: "blob" | "commit" | "tree";
}



//// export

export class GitWalkerRepo {
  cache?: Map<string, unknown>;
  ConstructEntry: typeof TreeEntry;
  fs: FsInterface;
  gitdir: string;
  mapPromise: Promise<Map<string, TreeEntryObject>>;

  constructor({ cache, fs, gitdir, ref }: GitWalkerRepoOptions) {
    this.cache = cache || new Map();
    this.fs = fs;
    this.gitdir = gitdir;

    this.mapPromise = (async() => {
      const map = new Map<string, TreeEntryObject>();
      const unifiedFs = adaptFsInterface(fs);
      let oid: string;

      try {
        oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });
      } catch(e) {
        if (e instanceof NotFoundError) {
          /*** Handle fresh branches with no commits ***/
          oid = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
        } else {
          throw e;
        }
      }

      const tree = await resolveTree({ cache: this.cache || new Map(), fs, gitdir, oid });
      const rootEntry: TreeEntryObject = { ...tree, mode: "40000", type: "tree" };
      map.set(".", rootEntry);

      return map;
    })();

    // deno-lint-ignore no-this-alias
    const walker = this;

    this.ConstructEntry = class extends TreeEntry {
      constructor(fullpath: string) {
        super(fullpath, walker);
      }
    };
  }

  async content(entry: TreeEntry): Promise<Uint8Array | void> {
    if (entry._content === false) {
      const map = await this.mapPromise;
      const { cache, fs, gitdir } = this;
      const obj = map.get(entry._fullpath);

      if (!obj)
        throw new Error(`No object found for path: ${entry._fullpath}`);

      const oid = obj.oid;
      const { object, type } = await readObject({ cache: cache || new Map(), fs, gitdir, oid });

      if (type !== "blob")
        entry._content = undefined;
      else
        entry._content = new Uint8Array(object);
    }

    return entry._content;
  }

  async mode(entry: TreeEntry): Promise<number> {
    if (entry._mode === false) {
      const map = await this.mapPromise;
      const obj = map.get(entry._fullpath);

      if (!obj)
        throw new Error(`No object found for path: ${entry._fullpath}`);

      entry._mode = normalizeMode(parseInt(obj.mode, 8));
    }

    return entry._mode as number;
  }

  async oid(entry: TreeEntry): Promise<string> {
    if (entry._oid === false) {
      const map = await this.mapPromise;
      const obj = map.get(entry._fullpath);

      if (!obj)
        throw new Error(`No object found for path: ${entry._fullpath}`);

      entry._oid = obj.oid;
    }

    return entry._oid as string;
  }

  async readdir(entry: TreeEntry): Promise<string[] | null> {
    const filepath = entry._fullpath;
    const { cache, fs, gitdir } = this;
    const map = await this.mapPromise;
    const obj = map.get(filepath);

    if (!obj)
      throw new Error(`No obj for ${filepath}`);

    const oid = obj.oid;

    if (!oid)
      throw new Error(`No oid for obj ${JSON.stringify(obj)}`);

    if (obj.type === "commit") {
      /*** This is a submodule (gitlink) - handle it specially ***/
      return [filepath === "." ? ".gitmodule" : `${filepath}/.gitmodule`];
    }

    if (obj.type !== "tree") {
      /*** Unsupported object type ***/
      return null;
    }

    const { object, type } = await readObject({ cache: cache || new Map(), fs, gitdir, oid });

    if (type !== obj.type)
      throw new ObjectTypeError(oid, type as any, obj.type as any);

    const tree = GitTree.from(object);

    /*** cache all entries ***/
    for (const entry of tree) {
      map.set(join(filepath, entry.path), entry as TreeEntryObject);
    }

    return tree.entries().map((entry) => join(filepath, entry.path));
  }

  stat(_entry: TreeEntry): Promise<unknown> {
    /*** No-op for repo walker ***/
    return Promise.resolve(undefined);
  }

  async type(entry: TreeEntry): Promise<"blob" | "commit" | "special" | "tree"> {
    if (entry._type === false) {
      const map = await this.mapPromise;
      const obj = map.get(entry._fullpath);

      if (!obj)
        throw new Error(`No object found for path: ${entry._fullpath}`);

      entry._type = obj.type;
    }

    return entry._type as "blob" | "commit" | "special" | "tree";
  }
}



//// helper

class TreeEntry implements WalkerEntry {
  _content: Uint8Array | undefined | false = false;
  _fullpath: string;
  _mode: number | false = false;
  _oid: string | false = false;
  _stat: unknown = false;
  _type: "blob" | "commit" | "special" | "tree" | false = false;

  constructor(fullpath: string, private walker: GitWalkerRepo) {
    this._fullpath = fullpath;
  }

  content(): Promise<Uint8Array | void> {
    return this.walker.content(this);
  }

  mode(): Promise<number> {
    return this.walker.mode(this);
  }

  oid(): Promise<string> {
    return this.walker.oid(this);
  }

  stat(): Promise<Deno.FileInfo> {
    return Promise.resolve(this.walker.stat(this) as unknown as Deno.FileInfo);
  }

  type(): Promise<"blob" | "commit" | "special" | "tree"> {
    return this.walker.type(this);
  }
}

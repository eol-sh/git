


//// util

import { GitWalkerRepo } from "../models/git-walker-repo.ts";
import { GitWalkSymbol } from "../utils/symbols.ts";

import type { Cache, FsInterface, Walker } from "../types.ts";

interface TreeOptions {
  ref?: string;
}

interface WalkerFactory {
  (args: { cache: Cache; fs: FsInterface; gitdir: string; }): GitWalkerRepo;
}



//// export

export function TREE({ ref = "HEAD" }: TreeOptions = {}): Walker {
  const o = Object.create(null);

  Object.defineProperty(o, GitWalkSymbol, {
    value: function ({ cache, fs, gitdir }: { cache: Cache; fs: FsInterface; gitdir: string; }) {
      return new GitWalkerRepo({ cache, fs, gitdir, ref });
    } as WalkerFactory,
  });

  Object.freeze(o);
  return o as Walker;
}

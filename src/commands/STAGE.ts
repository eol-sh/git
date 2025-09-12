


//// util

import { GitWalkerIndex } from "../models/git-walker-index.ts";
import { GitWalkSymbol } from "../utils/symbols.ts";

import type { Cache, FsInterface, Walker } from "../types.ts";

interface WalkerFactory {
  (args: { cache: Cache; fs: FsInterface; gitdir: string; }): GitWalkerIndex;
}



//// export

export function STAGE(): Walker {
  const o = Object.create(null);

  Object.defineProperty(o, GitWalkSymbol, {
    value: function (
      { cache, fs, gitdir }: { cache: Cache; fs: FsInterface; gitdir: string; },
    ) {
      return new GitWalkerIndex({ cache, fs, gitdir });
    } as WalkerFactory,
  });

  Object.freeze(o);
  return o as Walker;
}




//// util

import { GitWalkerFs } from "../models/git-walker-fs.ts";
import { GitWalkSymbol } from "../utils/symbols.ts";

import type { Cache, FsInterface, Walker } from "../types.ts";

interface WalkerFactory {
  (args: { cache: Cache; dir: string; fs: FsInterface; gitdir: string; }): GitWalkerFs;
}



//// export

export function WORKDIR(): Walker {
  const o = Object.create(null);

  Object.defineProperty(o, GitWalkSymbol, {
    value: function (
      { cache, dir, fs, gitdir }: {
        cache: Cache;
        dir: string;
        fs: FsInterface;
        gitdir: string;
      }
    ) {
      return new GitWalkerFs({ cache, dir, fs, gitdir });
    } as WalkerFactory,
  });

  Object.freeze(o);
  return o as Walker;
}

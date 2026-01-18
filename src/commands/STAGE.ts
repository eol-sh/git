/**
 * @fileoverview Git stage command implementation
 *
 * Internal implementation of the stage Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/stage.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


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

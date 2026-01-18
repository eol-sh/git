


/**
 * @fileoverview Command factory for creating working directory walkers
 * 
 * This module provides a factory function for creating working directory walker
 * objects that can traverse the actual filesystem. The WORKDIR walker enables
 * iteration over files and directories in the current working directory, supporting
 * operations that need to compare or synchronize repository content with the
 * actual filesystem state. It integrates with the walker system to provide
 * consistent filesystem traversal capabilities.
 * 
 * @module commands/workdir
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

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

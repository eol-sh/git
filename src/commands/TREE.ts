


/**
 * @fileoverview Command factory for creating Git tree walkers
 * 
 * This module provides a factory function for creating tree walker objects that
 * can traverse Git repository tree structures. The TREE walker enables iteration
 * over files and directories within a specific commit or tree object, supporting
 * operations that need to inspect repository content at specific points in history.
 * It integrates with the walker system to provide consistent tree traversal
 * capabilities across different Git operations.
 * 
 * @module commands/tree
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

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




/**
 * @fileoverview Command for locating the root directory of a Git repository
 * 
 * This module provides functionality to find the root directory of a Git repository
 * by walking up the directory tree from a given starting path. The command searches
 * for the presence of a .git directory or file, which indicates the repository root.
 * This is essential for determining the working directory and repository boundaries
 * when executing Git operations from subdirectories within a repository.
 * 
 * @module commands/find-root
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { dirname } from "../utils/dirname.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";

import type { FsInterface } from "../types.ts";

interface FindRootOptions {
  filepath: string;
  fs: FsInterface;
}



//// export

/**
 * Find the root git directory
 *
 * Starting at `filepath`, walks upward until it finds a directory that contains a subdirectory called ".git".
 */
export async function _findRoot({ filepath, fs }: FindRootOptions): Promise<string> {
  try {
    await fs.stat(join(filepath, ".git"));
    return filepath;
  } catch {
    const parent = dirname(filepath);

    if (parent === filepath)
      throw new NotFoundError(`git root for ${filepath}`);

    return _findRoot({ filepath: parent, fs });
  }
}

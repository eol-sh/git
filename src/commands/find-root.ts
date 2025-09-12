


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

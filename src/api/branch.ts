


//// util

import { _branch } from "../commands/branch.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface BranchOptions {
  checkout?: boolean;
  dir?: string;
  force?: boolean;
  fs: FsClient;
  gitdir?: string;
  object?: string;
  ref: string;
}



//// export

/**
 * Create a branch
 */
export async function branch({
  checkout = false,
  dir,
  force = false,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  object,
  ref
}: BranchOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);

    const fileSystem = new FileSystem(_fs);
    const fs = adaptFileSystem(fileSystem);

    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);

    const options: any = { fs, gitdir, ref };

    if (checkout !== undefined)
      options.checkout = checkout;

    if (force !== undefined)
      options.force = force;

    if (object !== undefined)
      options.object = object;

    return await _branch(options);
  } catch(err: unknown) {
    (err as any).caller = "git.branch";
    throw err;
  }
}

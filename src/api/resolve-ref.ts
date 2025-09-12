


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface ResolveRefOptions {
  cache?: Cache;
  depth?: number;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  ref: string;
}



//// export

/**
 * Get the value of a symbolic ref or resolve a ref to its SHA-1 object id
 */
export async function resolveRef({
  depth,
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  ref
}: ResolveRefOptions): Promise<string> {
  const unifiedFs = adaptFsInterface(fs);

  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("ref", ref);

    const oid = await GitRefManager.resolve({
      ...(depth !== undefined ? { depth } : {}),
      fs: unifiedFs,
      gitdir,
      ref
    });
    return oid;
  } catch(err: unknown) {
    (err as any).caller = "git.resolveRef";
    throw err;
  }
}

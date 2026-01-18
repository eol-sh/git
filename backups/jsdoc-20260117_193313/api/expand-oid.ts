


//// util

import { _expandOid } from "../storage/expand-oid.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Cache, FsClient } from "../types.ts";

interface ExpandOidOptions {
  cache?: Cache;
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  oid: string;
}



//// export

/**
 * Expand and resolve a short oid into a full oid
 */
export async function expandOid({
  cache = new Map(),
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  oid
}: ExpandOidOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);
    const fs = adaptFileSystem(new FileSystem(_fs));

    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    return await _expandOid({
      cache,
      fs,
      gitdir,
      oid
    });
  } catch(err: unknown) {
    (err as any).caller = "git.expandOid";
    throw err;
  }
}

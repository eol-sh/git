


//// util

import { _readCommit } from "../commands/read-commit.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { CommitObject, FsInterface } from "../types.ts";

interface ReadCommitOptions {
  cache?: Map<string, any>;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  oid: string;
}

interface ReadCommitResult {
  commit: CommitObject & { message: string };
  oid: string;
  payload: string;
}



//// export

/**
 * Read a commit object directly
 */
export async function readCommit({
  cache = new Map(),
  dir,
  fs,
  gitdir = dir ?
    join(dir, ".git") :
    "",
  oid
}: ReadCommitOptions): Promise<ReadCommitResult> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("oid", oid);

    return await _readCommit({
      cache,
      fs,
      gitdir,
      oid
    });
  } catch(err: unknown) {
    (err as any).caller = "git.readCommit";
    throw err;
  }
}

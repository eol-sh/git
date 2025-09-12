


//// util

import { _writeCommit } from "../commands/write-commit.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { CommitObject, FsInterface } from "../types.ts";



//// export

export interface WriteCommitOptions {
  commit: CommitObject;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
}

/**
 * Write a commit object directly
 *
 * @param args - The options for writeCommit
 * @param args.fs - a file system client
 * @param args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [required] The [git directory](dir-vs-gitdir.md) path
 * @param args.commit - The object to write
 *
 * @returns Resolves successfully with the SHA-1 object id of the newly written object
 */
export async function writeCommit({
  commit,
  dir,
  fs,
  gitdir = join(dir!, ".git")
}: WriteCommitOptions): Promise<string> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("commit", commit);

    return await _writeCommit({
      commit,
      fs: adaptFsInterface(fs),
      gitdir
    });
  } catch(err: unknown) {
    (err as any).caller = "git.writeCommit";
    throw err;
  }
}

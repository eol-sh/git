


//// util

import { GitCommit } from "../models/git-commit.ts";
import { _writeObject as writeObject } from "../storage/write-object.ts";

import type { CommitObject, FsInterface } from "../types.ts";

interface WriteCommitOptions {
  commit: CommitObject;
  fs: FsInterface;
  gitdir: string;
}



//// export

export async function _writeCommit({ commit, fs, gitdir }: WriteCommitOptions): Promise<string> {
  /*** Convert object to buffer ***/
  const object = GitCommit.from(commit).toObject();

  const oid = await writeObject({
    format: "content",
    fs,
    gitdir,
    object,
    type: "commit"
  });

  return oid;
}

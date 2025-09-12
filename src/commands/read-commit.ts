


//// util

import { resolveCommit } from "../utils/resolve-commit.ts";
import type { CommitObject, FsInterface } from "../types.ts";

interface ReadCommitOptions {
  cache: Map<string, any>;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}

interface ReadCommitResult {
  commit: CommitObject & { message: string };
  oid: string;
  payload: string;
}



//// export

export async function _readCommit({ cache, fs, gitdir, oid }: ReadCommitOptions): Promise<ReadCommitResult> {
  const { commit, oid: commitOid } = await resolveCommit({ cache, fs, gitdir, oid });

  const result = {
    commit: commit.parse(),
    oid: commitOid,
    payload: commit.withoutSignature()
  };

  return result;
}




/**
 * @fileoverview Command for writing Git commit objects to object storage
 * 
 * This module provides functionality to write Git commit objects to the repository's
 * object database. The command takes commit metadata including author, committer,
 * message, and tree reference, formats it according to Git's commit object format,
 * and stores it in the object database with proper SHA-1 hashing. This is a
 * low-level operation used by higher-level commit creation commands to persist
 * commit data to repository storage.
 * 
 * @module commands/write-commit
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

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

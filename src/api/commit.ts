


//// util

import { _commit } from "../commands/commit.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type { Author, Cache, Committer, FsClient, SignCallback } from "../types.ts";

interface CommitOptions {
  amend?: boolean;
  author?: Author;
  cache?: Cache;
  committer?: Committer;
  dir?: string;
  dryRun?: boolean;
  fs: FsClient;
  gitdir?: string;
  message?: string;
  noUpdateBranch?: boolean;
  onSign?: SignCallback;
  parent?: string[];
  ref?: string;
  signingKey?: string;
  tree?: string;
}



//// export

/**
 * Create a new commit
 */
export async function commit({
  amend = false,
  author,
  cache = new Map(),
  committer,
  dir,
  dryRun = false,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  message,
  noUpdateBranch = false,
  onSign,
  parent,
  ref,
  signingKey,
  tree
}: CommitOptions): Promise<string> {
  try {
    assertParameter("fs", _fs);

    if (!amend)
      assertParameter("message", message);

    if (signingKey)
      assertParameter("onSign", onSign);

    const fs = adaptFileSystem(new FileSystem(_fs));

    const options: any = {
      cache,
      fs,
      gitdir,
      message
    };

    if (amend !== undefined)
      options.amend = amend;

    if (author !== undefined)
      options.author = author;

    if (committer !== undefined)
      options.committer = committer;

    if (dryRun !== undefined)
      options.dryRun = dryRun;

    if (noUpdateBranch !== undefined)
      options.noUpdateBranch = noUpdateBranch;

    if (onSign !== undefined)
      options.onSign = onSign;

    if (parent !== undefined)
      options.parent = parent;

    if (ref !== undefined)
      options.ref = ref;

    if (signingKey !== undefined)
      options.signingKey = signingKey;

    if (tree !== undefined)
      options.tree = tree;

    return await _commit(options);
  } catch(err: unknown) {
    (err as any).caller = "git.commit";
    throw err;
  }
}

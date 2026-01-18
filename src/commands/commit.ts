


/**
 * @fileoverview Command for creating Git commit objects with comprehensive metadata handling
 * 
 * This module provides functionality to create Git commits, which are snapshots of the repository
 * state at a point in time. The command handles building tree objects from the current index,
 * setting up author and committer information, managing parent relationships for merge commits,
 * and optional commit signing with GPG keys. It supports both regular commits and amending
 * existing commits, with proper validation of commit requirements and reference management.
 * 
 * @module commands/commit
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { flatFileListToDirectoryStructure } from "../utils/flat-file-list-to-directory-structure.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitTree } from "../models/git-tree.ts";
import { MissingNameError } from "../errors/missing-name.ts";
import { MissingParameterError } from "../errors/missing-parameter.ts";
import { NoCommitError } from "../errors/no-commit.ts";
import { normalizeAuthorObject } from "../utils/normalize-author-object.ts";
import { normalizeCommitterObject } from "../utils/normalize-committer-object.ts";
import { _readCommit as readCommit } from "./read-commit.ts";
import { _writeObject as writeObject } from "../storage/write-object.ts";

import type { Author, Cache, Committer, FsInterface, OnSignCallback } from "../types.ts";

interface CommitOptions {
  amend?: boolean;
  author?: Author;
  cache: Cache;
  committer?: Committer;
  dryRun?: boolean;
  fs: FsInterface;
  gitdir: string;
  message?: string;
  noUpdateBranch?: boolean;
  onSign?: OnSignCallback;
  parent?: string[];
  ref?: string;
  signingKey?: string;
  tree?: string;
}

interface ConstructTreeOptions {
  dryRun?: boolean;
  fs: FsInterface;
  gitdir: string;
  inode: TreeNode;
}

interface TreeNode {
  basename: string;
  children: TreeNode[];
  metadata: {
    mode: string;
    oid: string;
  };
  type: "blob" | "tree";
}



//// export

export async function _commit({
  amend = false,
  author: _author,
  cache,
  committer: _committer,
  dryRun = false,
  fs,
  gitdir,
  message,
  noUpdateBranch = false,
  onSign,
  parent,
  ref,
  signingKey,
  tree
}: CommitOptions): Promise<string> {
  const unifiedFs = adaptFsInterface(fs);

  /*** Determine ref and the commit pointed to by ref, and if it is the initial commit ***/
  let initialCommit = false;

  if (!ref) {
    ref = await GitRefManager.resolve({
      depth: 2,
      fs: unifiedFs,
      gitdir,
      ref: "HEAD"
    });
  }

  let refOid: string | undefined, refCommit: any;

  try {
    refOid = await GitRefManager.resolve({
      fs: unifiedFs,
      gitdir,
      ref
    });

    refCommit = await readCommit({ cache: new Map(), fs, gitdir, oid: refOid });
  } catch {
    /*** We assume that there’s no commit and this is the initial commit ***/
    initialCommit = true;
  }

  if (amend && initialCommit)
    throw new NoCommitError(ref);

  /*** Determine author and committer information ***/
  const author = !amend ?
    await normalizeAuthorObject({
      ...(_author !== undefined ? { author: _author } : {}),
      fs,
      gitdir
    }) :
    await normalizeAuthorObject({
      ...(_author !== undefined ? { author: _author } : {}),
      commit: refCommit.commit,
      fs: unifiedFs,
      gitdir
    });

  if (!author)
    throw new MissingNameError("author");

  const committer = !amend ?
    await normalizeCommitterObject({
      author,
      ...(_committer !== undefined ? { committer: _committer } : {}),
      fs: unifiedFs,
      gitdir
    }) :
    await normalizeCommitterObject({
      author,
      commit: refCommit.commit,
      ...(_committer !== undefined ? { committer: _committer } : {}),
      fs: unifiedFs,
      gitdir
    });

  if (!committer)
    throw new MissingNameError("committer");

  return GitIndexManager.acquire(
    { allowUnmerged: false, cache, fs: unifiedFs, gitdir },
    async(index) => {
      const inodes = flatFileListToDirectoryStructure(index.entries);
      const inode = inodes.get(".");

      if (!tree && inode)
        tree = await constructTree({ ...(dryRun ? { dryRun } : {}), fs, gitdir, inode: inode as any }) as string;

      /*** Determine parents of this commit ***/
      if (!parent) {
        if (!amend)
          parent = refOid ? [refOid] : [];
        else
          parent = refCommit.commit.parent;
      } else {
        /*** ensure that the parents are oids, not refs ***/
        parent = await Promise.all(
          parent.map((p) => {
            return GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: p });
          })
        );
      }

      /*** Determine message of this commit ***/
      if (!message) {
        if (!amend)
          throw new MissingParameterError("message");
        else
          message = refCommit.commit.message;
      }

      /*** Create and write new Commit object ***/
      let comm = GitCommit.from({
        author,
        committer,
        message: message || "",
        parent: parent || [],
        tree: tree || ""
      });

      if (signingKey && onSign) {
        const signAdapter = async (options: { payload: string; secretKey: string }) => ({
          signature: await onSign(options.payload)
        });

        comm = await GitCommit.sign(comm, signAdapter, signingKey);
      }

      const oid = await writeObject({
        ...(dryRun ? { dryRun } : {}),
        fs: unifiedFs,
        gitdir,
        object: comm.toObject(),
        type: "commit"
      });

      if (!noUpdateBranch && !dryRun) {
        /*** Update branch pointer ***/
        await GitRefManager.writeRef({
          fs: unifiedFs,
          gitdir,
          ref,
          value: oid
        });
      }

      return oid;
    }
  );
}



//// helper

async function constructTree({ dryRun, fs, gitdir, inode }: ConstructTreeOptions): Promise<string> {
  /*** use depth first traversal ***/
  const children = inode.children;

  for (const inode of children) {
    if (inode.type === "tree") {
      inode.metadata.mode = "040000";

      inode.metadata.oid = await constructTree({
        ...(dryRun ? { dryRun } : {}),
        fs,
        gitdir,
        inode
      });
    }
  }

  const entries = children.map((inode) => ({
    mode: inode.metadata.mode,
    oid: inode.metadata.oid,
    path: inode.basename,
    type: inode.type,
  }));

  const tree = GitTree.from(entries);

  const oid = await writeObject({
    ...(dryRun ? { dryRun } : {}),
    fs,
    gitdir,
    object: tree.toObject(),
    type: "tree"
  });

  return oid;
}

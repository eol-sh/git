


//// util

import { _commit } from "../commands/commit.ts";
import { _currentBranch } from "../commands/current-branch.ts";
import { _findMergeBase } from "./find-merge-base.ts";
import { abbreviateRef } from "../utils/abbreviate-ref.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { FastForwardError } from "../errors/fast-forward.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { MergeConflictError } from "../errors/merge-conflict.ts";
import { MergeNotSupportedError } from "../errors/merge-not-supported.ts";
import { mergeTree } from "../utils/merge-tree.ts";

import type {
  Author,
  Cache,
  Committer,
  FsInterface,
  MergeDriverCallback,
  MergeResult,
  OnSignCallback
} from "../types.ts";

interface MergeOptions {
  abortOnConflict?: boolean;
  allowUnrelatedHistories?: boolean;
  author: Author;
  cache: Cache;
  committer: Committer;
  dir: string;
  dryRun?: boolean;
  fastForward?: boolean;
  fastForwardOnly?: boolean;
  fs: FsInterface;
  gitdir: string;
  mergeDriver?: MergeDriverCallback;
  message?: string;
  noUpdateBranch?: boolean;
  onSign?: OnSignCallback;
  ours?: string;
  signingKey?: string;
  theirs: string;
}



//// export

export async function _merge({
  abortOnConflict = true,
  allowUnrelatedHistories = false,
  author,
  cache,
  committer,
  dir,
  dryRun = false,
  fastForward = true,
  fastForwardOnly = false,
  fs,
  gitdir,
  mergeDriver,
  message,
  noUpdateBranch = false,
  onSign,
  ours,
  signingKey,
  theirs
}: MergeOptions): Promise<MergeResult> {
  const unifiedFs = adaptFsInterface(fs);

  if (ours === undefined)
    ours = await _currentBranch({ fs, fullname: true, gitdir });

  ours = await GitRefManager.expand({ fs: unifiedFs, gitdir, ref: ours! }) || ours!;
  theirs = await GitRefManager.expand({ fs: unifiedFs, gitdir, ref: theirs! }) || theirs!;

  const ourOid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: ours! });
  const theirOid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: theirs! });

  /*** find most recent common ancestor of ref a and ref b ***/
  const baseOids = await _findMergeBase({
    cache,
    fs,
    gitdir,
    oids: [ourOid, theirOid]
  });

  if (baseOids.length !== 1) {
    if (baseOids.length === 0 && allowUnrelatedHistories) {
      /*** 4b825…  == the empty tree used by git ***/
      baseOids.push("4b825dc642cb6eb9a060e54bf8d69288fbee4904");
    } else if (baseOids.length > 1) {
      /*** Implement basic recursive merge strategy
      When there are multiple merge bases, we need to create a virtual merge base
      by recursively merging the multiple bases ***/
      let virtualBase = baseOids[0];

      for (let i = 1; i < baseOids.length; i++) {
        const intermediateResult = await _merge({
          allowUnrelatedHistories: true,
          author,
          cache,
          committer,
          dir,
          dryRun: true, /*** Don’t update refs for intermediate merges ***/
          fastForward: false,
          fs,
          gitdir,
          message: `Virtual merge base between ${virtualBase.slice(0,7)} and ${baseOids[i].slice(0,7)}`,
          noUpdateBranch: true,
          ours: virtualBase,
          theirs: baseOids[i]
        });

        if (intermediateResult.tree) {
          virtualBase = intermediateResult.tree;
        } else {
          /*** If we can’t create a virtual merge base, fall back to using the first base ***/
          console.warn(`Failed to create virtual merge base, using first base: ${baseOids[0]}`);
          virtualBase = baseOids[0];
          break;
        }
      }

      baseOids.length = 1;
      baseOids[0] = virtualBase;
    } else {
      throw new MergeNotSupportedError();
    }
  }

  const baseOid = baseOids[0];

  /*** handle fast-forward case ***/
  if (baseOid === theirOid) {
    return {
      alreadyMerged: true,
      oid: ourOid
    };
  }

  if (fastForward && baseOid === ourOid) {
    if (!dryRun && !noUpdateBranch)
      await GitRefManager.writeRef({ fs: unifiedFs, gitdir, ref: ours, value: theirOid });

    return {
      fastForward: true,
      oid: theirOid
    };
  } else {
    /*** not a simple fast-forward ***/
    if (fastForwardOnly)
      throw new FastForwardError();

    /*** try a fancier merge ***/
    const tree = await GitIndexManager.acquire(
      { allowUnmerged: false, cache, fs: unifiedFs, gitdir },
      (index) => {
        return mergeTree({
          abortOnConflict,
          baseName: "base",
          baseOid,
          cache,
          dir,
          dryRun,
          fs,
          gitdir,
          index: index as any,
          ...(mergeDriver !== undefined ? { mergeDriver } : {}),
          ourName: abbreviateRef(ours),
          ourOid,
          theirName: abbreviateRef(theirs),
          theirOid
        });
      }
    );

    /*** Defer throwing error until the index lock is relinquished and index is
    written to filesystem ***/
    if (tree instanceof MergeConflictError)
      throw tree;

    if (!message)
      message = `Merge branch "${abbreviateRef(theirs)}" into ${abbreviateRef(ours)}`;

    const oid = await _commit({
      author,
      cache,
      committer,
      dryRun,
      fs,
      gitdir,
      message,
      noUpdateBranch,
      ...(onSign !== undefined ? { onSign } : {}),
      parent: [ourOid, theirOid],
      ref: ours,
      ...(signingKey !== undefined ? { signingKey } : {}),
      tree: tree as string
    });

    return {
      mergeCommit: true,
      oid,
      tree: tree as string
    };
  }
}

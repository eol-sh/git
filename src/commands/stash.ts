


/**
 * @fileoverview Command for managing Git stash operations including save, apply, and list
 * 
 * This module provides comprehensive Git stash functionality for temporarily saving
 * and restoring working directory and index changes. The command supports creating
 * new stashes from current changes, applying stashed changes back to the working
 * directory, listing existing stashes, and managing the stash stack. It handles
 * proper three-way merging when applying stashes and maintains the stash reference
 * log for tracking stash history.
 * 
 * @module commands/stash
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { _currentBranch } from "./current-branch.ts";
import { _readCommit } from "./read-commit.ts";
import { acquireLock, applyTreeChanges, writeTreeChanges } from "../utils/walker-to-tree-entry-map.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { checkout } from "../api/checkout.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitStashManager } from "../managers/git-stash.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { readCommit } from "../api/read-commit.ts";
import { STAGE } from "./stage.ts";
import { TREE } from "./tree.ts";

import type { FsInterface } from "../types.ts";

interface StashOptions {
  dir: string;
  fs: FsInterface;
  gitdir: string;
}

interface StashApplyOptions extends StashOptions {
  refIdx?: number;
}

interface StashDropOptions extends StashOptions {
  refIdx?: number;
}

interface StashPopOptions extends StashOptions {
  refIdx?: number;
}

interface StashPushOptions extends StashOptions {
  message?: string;
}



//// export

export async function _stashApply({ dir, fs, gitdir, refIdx = 0 }: StashApplyOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);
  const stashMgr = new GitStashManager({ fs: unifiedFs, gitdir });

  /*** get the stash commit object ***/
  const stashCommit = await stashMgr.readStashCommit(refIdx);

  const { parent: stashParents = null } = (stashCommit as any).commit ?
    (stashCommit as any).commit :
    {};

  if (!stashParents || !Array.isArray(stashParents))
    return; /*** no stash found ***/

  /*** compare the stash commit tree with its parent commit ***/
  for (let i = 0; i < stashParents.length - 1; i++) {
    const applyingCommit = await _readCommit({
      cache: new Map(),
      fs,
      gitdir,
      oid: stashParents[i + 1]
    });

    const wasStaged = applyingCommit.commit.message.startsWith("stash-Index");

    await applyTreeChanges({
      dir,
      fs,
      gitdir,
      parentCommit: stashParents[i],
      stashCommit: stashParents[i + 1],
      wasStaged
    });
  }
}

export async function _stashClear({ fs, gitdir }: Omit<StashOptions, "dir">): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);
  const stashMgr = new GitStashManager({ fs: unifiedFs, gitdir });
  const stashRefPath = [stashMgr.refStashPath, stashMgr.refLogsStashPath];

  await acquireLock(stashRefPath[0], async() => {
    await Promise.all(
      stashRefPath.map(async(path) => {
        try {
          await fs.lstat(path);
          return fs.unlink(path);
        } catch {
          /*** File doesn’t exist, skip ***/
        }
      })
    );
  });
}

export async function _stashDrop({ fs, gitdir, refIdx = 0 }: Omit<StashDropOptions, "dir">): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);
  const stashMgr = new GitStashManager({ fs: unifiedFs, gitdir });
  const stashCommit = await stashMgr.readStashCommit(refIdx);

  if (!(stashCommit as any).commit)
    return; /*** no stash found ***/

  /*** remove stash ref first ***/
  const stashRefPath = stashMgr.refStashPath;

  await acquireLock(stashRefPath, async() => {
    try {
      await fs.lstat(stashRefPath);
      await fs.unlink(stashRefPath);
    } catch {
      /*** File doesn’t exist, skip ***/
    }
  });

  /*** read from stash reflog and list the stash commits ***/
  const reflogEntries = await stashMgr.readStashReflogs({ parsed: false });

  if (!reflogEntries.length)
    return; /*** no stash reflog entry ***/

  /*** remove the specified stash reflog entry from reflogEntries, then update the stash reflog ***/
  reflogEntries.splice(refIdx, 1);

  const stashReflogPath = stashMgr.refLogsStashPath;

  await acquireLock(stashReflogPath, async() => {
    if (reflogEntries.length) {
      await fs.writeFile(stashReflogPath, new TextEncoder().encode(reflogEntries.join("\n")));
      const lastStashCommit = reflogEntries[reflogEntries.length - 1].split(" ")[1];
      await stashMgr.writeStashRef(lastStashCommit);
    } else {
      /*** remove the stash reflog file if no entry left ***/
      await fs.unlink(stashReflogPath);
    }
  });
}

export function _stashList({ fs, gitdir }: Omit<StashOptions, "dir">): Promise<unknown[]> {
  const unifiedFs = adaptFsInterface(fs);
  const stashMgr = new GitStashManager({ fs: unifiedFs, gitdir });

  return stashMgr.readStashReflogs({ parsed: true });
}

export async function _stashPop({ dir, fs, gitdir, refIdx = 0 }: StashPopOptions): Promise<void> {
  await _stashApply({ dir, fs, gitdir, refIdx });
  await _stashDrop({ fs, gitdir, refIdx });
}

export async function _stashPush({ dir, fs, gitdir, message = "" }: StashPushOptions): Promise<string> {
  const unifiedFs = adaptFsInterface(fs);
  const stashMgr = new GitStashManager({ fs: unifiedFs, gitdir });
  await stashMgr.getAuthor(); /*** ensure there is an author ***/

  const branch = await _currentBranch({
    fs,
    fullname: false,
    gitdir
  });

  /*** prepare the stash commit: first parent is the current branch HEAD ***/
  const headCommit = await GitRefManager.resolve({
    fs: unifiedFs,
    gitdir,
    ref: "HEAD"
  });

  const headCommitObj = await readCommit({ fs, dir, gitdir, oid: headCommit });
  const headMsg = headCommitObj.commit.message;

  const stashCommitParents = [headCommit];
  let stashCommitTree: string | null = null;
  let workDirCompareBase = TREE({ ref: "HEAD" });

  const indexTree = await writeTreeChanges({
    dir,
    fs,
    gitdir,
    treePair: [TREE({ ref: "HEAD" }), "stage"]
  });

  if (indexTree) {
    /*** this indexTree will be the tree of the stash commit
    create a commit from the index tree, which has one parent, the current branch HEAD ***/
    const stashCommitOne = await stashMgr.writeStashCommit({
      message: `stash-Index: WIP on ${branch} - ${new Date().toISOString()}`,
      parent: stashCommitParents,
      tree: indexTree /*** stashCommitTree ***/
    });

    stashCommitParents.push(stashCommitOne);
    stashCommitTree = indexTree;
    workDirCompareBase = STAGE();
  }

  const workingTree = await writeTreeChanges({
    dir,
    fs,
    gitdir,
    treePair: [workDirCompareBase, "workdir"]
  });

  if (workingTree) {
    /*** create a commit from the working directory tree, which has one parent, either the one we just had, or the headCommit ***/
    const workingHeadCommit = await stashMgr.writeStashCommit({
      message: `stash-WorkDir: WIP on ${branch} - ${new Date().toISOString()}`,
      parent: [stashCommitParents[stashCommitParents.length - 1]],
      tree: workingTree
    });

    stashCommitParents.push(workingHeadCommit);
    stashCommitTree = workingTree;
  }

  if (!stashCommitTree || (!indexTree && !workingTree))
    throw new NotFoundError("changes, nothing to stash");

  /*** create another commit from the tree, which has three parents: HEAD and the commit we just made: ***/
  const stashMsg = (message.trim() || `WIP on ${branch}`) + `: ${headCommit.substring(0, 7)} ${headMsg}`;

  const stashCommit = await stashMgr.writeStashCommit({
    message: stashMsg,
    parent: stashCommitParents,
    tree: stashCommitTree
  });

  /*** next, write this commit into .git/refs/stash: ***/
  await stashMgr.writeStashRef(stashCommit);

  /*** write the stash commit to the logs ***/
  await stashMgr.writeStashReflogEntry({
    message: stashMsg,
    stashCommit
  });

  /*** finally, go back to a clean working directory ***/
  if (branch) {
    await checkout({
      dir,
      force: true, /*** force checkout to discard changes ***/
      fs,
      gitdir,
      ref: branch,
      track: false
    });
  }

  return stashCommit;
}

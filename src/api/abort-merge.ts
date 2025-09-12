


//// util

import "../typedefs.ts";

import { _walk } from "../commands/walk.ts";
import { adaptFileSystem, adaptFsInterfaceForGitIndex } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { IndexResetError } from "../errors/index-reset.ts";
import { join } from "../utils/join.ts";
import { modified } from "../utils/modified.ts";
import { STAGE } from "../commands/stage.ts";
import { TREE } from "../commands/tree.ts";
import { WORKDIR } from "../commands/workdir.ts";

import type { WalkerEntry } from "../types.ts";



//// export

/**
 * Abort a merge in progress.
 *
 * Based on the behavior of git reset --merge, i.e.  "Resets the index and updates the files in the working tree that are different between <commit> and HEAD, but keeps those which are different between the index and working tree (i.e. which have changes which have not been added). If a file that is different between <commit> and the index has unstaged changes, reset is aborted."
 *
 * Essentially, abortMerge will reset any files affected by merge conflicts to their last known good version at HEAD.
 * Any unstaged changes are saved and any staged changes are reset as well.
 *
 * NOTE: The behavior of this command differs slightly from canonical git in that an error will be thrown if a file exists in the index and nowhere else.
 * Canonical git will reset the file and continue aborting the merge in this case.
 *
 * **WARNING:** Running git merge with non-trivial uncommitted changes is discouraged: while possible, it may leave you in a state that is hard to back out of in the case of a conflict.
 * If there were uncommitted changes when the merge started (and especially if those changes were further modified after the merge was started), `git.abortMerge` will in some cases be unable to reconstruct the original (pre-merge) changes.
 *
 * @param {object} args
 * @param {FsClient} args.fs - a file system implementation
 * @param {string} args.dir - The [working tree](dir-vs-gitdir.md) directory path
 * @param {string} [args.gitdir=join(dir, ".git")] - [required] The [git directory](dir-vs-gitdir.md) path
 * @param {string} [args.commit="HEAD"] - commit to reset the index and worktree to, defaults to HEAD
 * @param {object} [args.cache] - a [cache](cache.md) object
 *
 * @returns {Promise<void>} Resolves successfully once the git index has been updated
 */
export async function abortMerge({
  cache = new Map(),
  commit = "HEAD",
  dir,
  fs: _fs,
  gitdir = join(dir, ".git")
}) {
  try {
    assertParameter("fs", _fs);
    assertParameter("dir", dir);
    assertParameter("gitdir", gitdir);

    const fs = adaptFileSystem(new FileSystem(_fs));
    const trees = [TREE({ ref: commit }), WORKDIR(), STAGE()];
    let unmergedPaths: string[] = [];

    await GitIndexManager.acquire(
      { cache, fs: adaptFsInterfaceForGitIndex(fs), gitdir },
      (index) => {
        unmergedPaths = index.unmergedPaths;
      }
    );

    const results = await _walk({
      cache,
      dir,
      fs,
      gitdir,
      map: async(path: string, entries: (WalkerEntry | null)[]) => {
        const [head, workdir, index] = entries;
        const staged = !(await modified(workdir, index));
        const unmerged = unmergedPaths.includes(path);
        const unmodified = !(await modified(index, head));

        if (staged || unmerged) {
          return head ? {
              content: await head.content(),
              mode: await head.mode(),
              oid: await head.oid(),
              path,
              type: await head.type()
            } :
            undefined;
        }

        if (unmodified)
          return false;
        else
          throw new IndexResetError(path);
      },
      trees
    });

    await GitIndexManager.acquire(
      { cache, fs: adaptFsInterfaceForGitIndex(fs), gitdir },
      async(index) => {
        /*** Reset paths in index and worktree, this can’t be done in _walk because the
        STAGE walker acquires its own index lock. ***/

        for (const entry of results as any[]) {
          if (entry === false)
            continue;

          /*** entry is not false, so from here we can assume index = workdir ***/
          if (!entry) {
            /*** This case shouldn’t happen based on logic, but skip if entry is null ***/
            continue;
          }

          if (entry.type === "blob") {
            const content = entry.content instanceof Uint8Array ?
              entry.content :
              new TextEncoder().encode(entry.content as string);

            await fs.writeFile(`${dir}/${entry.path}`, content);

            index.insert({
              filepath: entry.path,
              oid: entry.oid,
              stage: 0
            });
          }
        }
      }
    );
  } catch(err: any) {
    if (err && typeof err === "object")
      (err as any).caller = "git.abortMerge";

    throw err;
  }
}

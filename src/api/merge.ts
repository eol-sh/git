


//// util

import { _merge } from "../commands/merge.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";
import { MissingNameError } from "../errors/missing-name.ts";
import { normalizeAuthorObject } from "../utils/normalize-author-object.ts";
import { normalizeCommitterObject } from "../utils/normalize-committer-object.ts";

import type {
  Author,
  Cache,
  Committer,
  FsInterface,
  MergeDriverCallback,
  MergeResult,
  SignCallback
} from "../types.ts";



//// export

/**
 * Options for the merge operation
 */
export interface MergeOptions {
  /** If true, merges with conflicts will not update the worktree or index. */
  abortOnConflict?: boolean;
  /** If true, allows merging histories of two branches that started their lives independently. */
  allowUnrelatedHistories?: boolean;
  /** passed to [commit](commit.md) when creating a merge commit */
  author?: Partial<Author>;
  /** a [cache](cache.md) object */
  cache?: Cache;
  /** passed to [commit](commit.md) when creating a merge commit */
  committer?: Partial<Committer>;
  /** The [working tree](dir-vs-gitdir.md) directory path */
  dir?: string;
  /** If true, simulates a merge so you can test whether it would succeed. */
  dryRun?: boolean;
  /** If false, create a merge commit in all cases. */
  fastForward?: boolean;
  /** If true, then non-fast-forward merges will throw an Error instead of performing a merge. */
  fastForwardOnly?: boolean;
  /** a file system client */
  fs: FsInterface;
  /** [required] The [git directory](dir-vs-gitdir.md) path */
  gitdir?: string;
  /** a [merge driver](mergeDriver.md) implementation */
  mergeDriver?: MergeDriverCallback;
  /** Overrides the default auto-generated merge commit message */
  message?: string;
  /** If true, does not update the branch pointer after creating the commit. */
  noUpdateBranch?: boolean;
  /** a PGP signing implementation */
  onSign?: SignCallback;
  /** The branch receiving the merge. If undefined, defaults to the current branch. */
  ours?: string;
  /** passed to [commit](commit.md) when creating a merge commit */
  signingKey?: string;
  /** The branch to be merged */
  theirs: string;
}

/**
 * Merge two branches
 *
 * Currently it will fail if multiple candidate merge bases are found. (It doesn’t yet implement the recursive merge strategy.)
 *
 * Currently it does not support selecting alternative merge strategies.
 *
 * Currently it is not possible to abort an incomplete merge. To restore the worktree to a clean state, you will need to checkout an earlier commit.
 *
 * Currently it does not directly support the behavior of `git merge --continue`. To complete a merge after manual conflict resolution, you will need to add and commit the files manually, and specify the appropriate parent commits.
 *
 * ## Manually resolving merge conflicts
 * By default, if @eol/git encounters a merge conflict it cannot resolve using the builtin diff3 algorithm or provided merge driver, it will abort and throw a `MergeNotSupportedError`.
 * This leaves the index and working tree untouched.
 *
 * When `abortOnConflict` is set to `false`, and a merge conflict cannot be automatically resolved, a `MergeConflictError` is thrown and the results of the incomplete merge will be written to the working directory.
 * This includes conflict markers in files with unresolved merge conflicts.
 *
 * To complete the merge, edit the conflicting files as you see fit, and then add and commit the resolved merge.
 *
 * For a proper merge commit, be sure to specify the branches or commits you are merging in the `parent` argument to `git.commit`.
 * For example, say we are merging the branch `feature` into the branch `main` and there is a conflict we want to resolve manually.
 * The flow would look like this:
 *
 * ```
 * await git.merge({
 *   abortOnConflict: false,
 *   dir,
 *   fs,
 *   ours: "main",
 *   theirs: "feature"
 * }).catch(e => {
 *   if (e instanceof Errors.MergeConflictError) {
 *     console.log(
 *       "Automatic merge failed for the following files: "
 *       + `${e.data}. `
 *       + "Resolve these conflicts and then commit your changes."
 *     )
 *   } else throw e
 * });
 *
 * // This is the where we manually edit the files that have been written to the working directory
 * // ...
 * // Files have been edited and we are ready to commit
 *
 * await git.add({
 *   dir,
 *   filepath: ".",
 *   fs
 * });
 *
 * await git.commit({
 *   dir,
 *   fs,
 *   message: "Merge branch "feature" into main",
 *   parent: ["main", "feature"], // Be sure to specify the parents when creating a merge commit
 *   ref: "main"
 * });
 * ```
 *
 * @param args - Options for the merge operation
 * @returns Resolves to a description of the merge operation
 *
 * @example
 * let m = await git.merge({
 *   dir: "/tutorial",
 *   fs,
 *   ours: "main",
 *   theirs: "remotes/origin/main"
 * });
 * console.log(m);
 */
export async function merge({
  abortOnConflict = true,
  allowUnrelatedHistories = false,
  author: _author,
  cache = new Map(),
  committer: _committer,
  dir,
  dryRun = false,
  fastForward = true,
  fastForwardOnly = false,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  mergeDriver,
  message,
  noUpdateBranch = false,
  onSign,
  ours,
  signingKey,
  theirs
}: MergeOptions): Promise<MergeResult> {
  try {
    assertParameter("fs", _fs);

    if (signingKey)
      assertParameter("onSign", onSign);

    const unifiedFs = adaptFsInterface(_fs);

    const author = await normalizeAuthorObject({
      ...(_author ? { author: _author } : {}),
      fs: _fs,
      gitdir
    });

    if (!author && (!fastForwardOnly || !fastForward))
      throw new MissingNameError("author");

    const committer = await normalizeCommitterObject({
      ...(author ? { author } : {}),
      ...(_committer ? { committer: _committer } : {}),
      fs: _fs,
      gitdir
    });

    if (!committer && (!fastForwardOnly || !fastForward))
      throw new MissingNameError("committer");

    return await _merge({
      abortOnConflict,
      allowUnrelatedHistories,
      author: author!,
      cache,
      committer: committer!,
      dir: dir!,
      dryRun,
      fastForward,
      fastForwardOnly,
      fs: unifiedFs,
      gitdir,
      ...(mergeDriver !== undefined ? { mergeDriver } : {}),
      ...(message !== undefined ? { message } : {}),
      noUpdateBranch,
      ...(onSign !== undefined ? { onSign } : {}),
      ...(ours !== undefined ? { ours } : {}),
      ...(signingKey !== undefined ? { signingKey } : {}),
      theirs
    });
  } catch(err: unknown) {
    (err as any).caller = "git.merge";
    throw err;
  }
}

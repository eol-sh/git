/**
 * @fileoverview Git stash API - High-level user interface
 *
 * This module provides the public API for stash operations in the Git implementation.
 * It handles parameter validation, file system adaptation, and error handling.
 *
 * @module api/stash.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import {
  _stashApply,
  _stashClear,
  _stashDrop,
  _stashList,
  _stashPop,
  _stashPush
} from "../commands/stash.ts";

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { InvalidRefNameError } from "../errors/invalid-ref-name.ts";
import { join } from "../utils/join.ts";

import type { FsInterface, StashOp } from "../types.ts";



//// export

export interface StashOptions {
  dir: string;
  fs: FsInterface;
  gitdir?: string;
  message?: string;
  op?: StashOp;
  refIdx?: number;
}

/**
 * stash api, supports  {"push" | "pop" | "apply" | "drop" | "list" | "clear"} StashOp
 * _note_,
 * - all stash operations are done on tracked files only with loose objects, no packed objects
 * - when op === "push", both working directory and index (staged) changes will be stashed, tracked files only
 * - when op === "push", message is optional, and only applicable when op === "push"
 * - when op === "apply | pop", the stashed changes will overwrite the working directory, no abort when conflicts
 *
 * @param args - The options for stash
 * @param args.fs - [required] a file system client
 * @param args.dir - [required] The [working tree](dir-vs-gitdir.md) directory path
 * @param args.gitdir - [optional] The [git directory](dir-vs-gitdir.md) path
 * @param args.op - [optional] name of stash operation, default to "push"
 * @param args.message - [optional] message to be used for the stash entry, only applicable when op === "push"
 * @param args.refIdx - [optional - Number] stash ref index of entry, only applicable when op === ["apply" | "drop" | "pop"], refIdx >= 0 and < num of stash pushed
 * @returns Resolves successfully when stash operations are complete
 *
 * @example
 * // stash changes in the working directory and index
 * let dir = "/tutorial";
 * await fs.promises.writeFile(`${dir}/a.txt`, "original content - a");
 * await fs.promises.writeFile(`${dir}/b.js`, "original content - b");
 * await git.add({ dir, filepath: [`a.txt`,`b.txt`], fs });
 * let sha = await git.commit({
 *   author: {
 *     email: "mstasher@stash.com",
 *     name: "Mr. Stash"
 *   },
 *   dir,
 *   fs,
 *   message: "add a.txt and b.txt to test stash"
 * });
 * console.log(sha);
 *
 * await fs.promises.writeFile(`${dir}/a.txt`, "stashed chang- a");
 * await git.add({ dir, filepath: `${dir}/a.txt`, fs });
 * await fs.promises.writeFile(`${dir}/b.js`, "work dir change. not stashed - b");
 *
 * await git.stash({ dir, fs }); // default gitdir and op
 *
 * console.log(await git.status({ dir, filepath: "a.txt", fs })); // "unmodified"
 * console.log(await git.status({ dir, filepath: "b.txt", fs })); // "unmodified"
 *
 * const refLog = await git.stash({ dir, fs, op: "list" });
 * console.log(refLog); // [{stash{#} message}]
 *
 * await git.stash({ dir, fs, op: "apply" }); // apply the stash
 *
 * console.log(await git.status({ dir, filepath: "a.txt", fs })); // "modified"
 * console.log(await git.status({ dir, filepath: "b.txt", fs })); // "*modified"
 */
export async function stash({
  dir,
  fs,
  gitdir = join(dir, ".git"),
  message = "",
  op = "push",
  refIdx = 0
}: StashOptions): Promise<string | void | unknown[]> {
  assertParameter("fs", fs);
  assertParameter("dir", dir);
  assertParameter("gitdir", gitdir);
  assertParameter("op", op);

  const stashMap = {
    apply: _stashApply,
    clear: _stashClear,
    drop: _stashDrop,
    list: _stashList,
    push: _stashPush,
    pop: _stashPop
  };

  const opsNeedRefIdx = ["apply", "drop", "pop"] as const;

  try {
    const _fs = adaptFsInterface(fs);
    const folders = ["refs", "logs", "logs/refs"];

    folders
      .map((f) => join(gitdir, f))
      .forEach(async(folder) => {
        if (!(await _fs.exists(folder)))
          await _fs.mkdir(folder);
      });

    const opFunc = stashMap[op];

    if (opFunc) {
      if (opsNeedRefIdx.includes(op as any) && refIdx < 0) {
        throw new InvalidRefNameError(
          `stash@${refIdx}`,
          "number that is in range of [0, num of stash pushed]"
        );
      }

      return await opFunc({ dir, fs, gitdir, message, refIdx });
    }

    throw new Error(`To be implemented: ${op}`);
  } catch(err: unknown) {
    (err as any).caller = "git.stash";
    throw err;
  }
}

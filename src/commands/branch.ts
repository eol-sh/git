


/**
 * @fileoverview Git branch command implementation
 *
 * Internal implementation of the branch Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/branch.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// import

import cleanGitRef from "clean-git-ref";

//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { AlreadyExistsError } from "../errors/already-exists.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { InvalidRefNameError } from "../errors/invalid-ref-name.ts";

import type { FsInterface } from "../types.ts";

interface BranchOptions {
  checkout?: boolean;
  force?: boolean;
  fs: FsInterface;
  gitdir: string;
  object?: string;
  ref: string;
}



//// export

/**
 * Create a branch
 */
export async function _branch({
  checkout = false,
  force = false,
  fs,
  gitdir,
  object,
  ref
}: BranchOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);

  if (ref !== cleanGitRef.clean(ref))
    throw new InvalidRefNameError(ref, cleanGitRef.clean(ref));

  const fullref = `refs/heads/${ref}`;

  if (!force) {
    const exist = await GitRefManager.exists({ fs: unifiedFs, gitdir, ref: fullref });

    if (exist)
      throw new AlreadyExistsError("branch", ref, false);
  }

  /*** Get current HEAD tree oid ***/
  let oid: string | undefined;

  try {
    oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: object || "HEAD" });
  } catch {
    /*** Probably an empty repo ***/
  }

  /*** Create a new ref that points at the current commit ***/
  if (oid)
    await GitRefManager.writeRef({ fs: unifiedFs, gitdir, ref: fullref, value: oid });

  if (checkout) {
    /*** Update HEAD ***/
    await GitRefManager.writeSymbolicRef({
      fs: unifiedFs,
      gitdir,
      ref: "HEAD",
      value: fullref
    });
  }
}

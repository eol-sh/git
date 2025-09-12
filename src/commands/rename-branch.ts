


//// import

import cleanGitRef from "clean-git-ref";

//// util

import { _currentBranch } from "./current-branch.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { AlreadyExistsError } from "../errors/already-exists.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { InvalidRefNameError } from "../errors/invalid-ref-name.ts";

import type { FsInterface } from "../types.ts";

interface RenameBranchOptions {
  checkout?: boolean;
  fs: FsInterface;
  gitdir: string;
  oldref: string;
  ref: string;
}



//// export

/**
 * Rename a branch
 */
export async function _renameBranch({
  checkout = false,
  fs,
  gitdir,
  oldref,
  ref
}: RenameBranchOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);

  if (ref !== cleanGitRef.clean(ref))
    throw new InvalidRefNameError(ref, cleanGitRef.clean(ref));

  if (oldref !== cleanGitRef.clean(oldref))
    throw new InvalidRefNameError(oldref, cleanGitRef.clean(oldref));

  const fulloldref = `refs/heads/${oldref}`;
  const fullnewref = `refs/heads/${ref}`;
  const newexist = await GitRefManager.exists({ fs: adaptFsInterface(fs), gitdir, ref: fullnewref });

  if (newexist)
    throw new AlreadyExistsError("branch", ref, false);

  const value = await GitRefManager.resolve({
    depth: 1,
    fs: adaptFsInterface(fs),
    gitdir,
    ref: fulloldref
  });

  await GitRefManager.writeRef({ fs: unifiedFs, gitdir, ref: fullnewref, value });
  await GitRefManager.deleteRef({ fs: unifiedFs, gitdir, ref: fulloldref });

  const fullCurrentBranchRef = await _currentBranch({
    fs,
    fullname: true,
    gitdir
  });

  const isCurrentBranch = fullCurrentBranchRef === fulloldref;

  if (checkout || isCurrentBranch) {
    /*** Update HEAD ***/
    await GitRefManager.writeSymbolicRef({
      fs: adaptFsInterface(fs),
      gitdir,
      ref: "HEAD",
      value: fullnewref
    });
  }
}

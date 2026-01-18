


/**
 * @fileoverview Command for safely deleting Git branches with proper cleanup
 * 
 * This module provides functionality to delete Git branches while ensuring proper
 * safety checks and cleanup operations. The command validates branch existence,
 * handles HEAD detachment when deleting the currently checked-out branch, removes
 * branch references from the refs namespace, and cleans up associated configuration
 * entries. It manages both local branch deletion and configuration cleanup to
 * maintain repository consistency.
 * 
 * @module commands/delete-branch
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { _currentBranch } from "./current-branch.ts";
import { abbreviateRef } from "../utils/abbreviate-ref.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { NotFoundError } from "../errors/not-found.ts";

import type { FsInterface } from "../types.ts";

interface DeleteBranchOptions {
  fs: FsInterface;
  gitdir: string;
  ref: string;
}



//// export

export async function _deleteBranch({ fs, gitdir, ref }: DeleteBranchOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);

  ref = ref.startsWith("refs/heads/") ?
    ref :
    `refs/heads/${ref}`;

  const exist = await GitRefManager.exists({ fs: unifiedFs, gitdir, ref });

  if (!exist)
    throw new NotFoundError(ref);

  const fullRef = await GitRefManager.expand({ fs: unifiedFs, gitdir, ref });
  const currentRef = await _currentBranch({ fs, fullname: true, gitdir });

  if (fullRef === currentRef) {
    /*** detach HEAD ***/
    const value = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: fullRef });
    await GitRefManager.writeRef({ fs: unifiedFs, gitdir, ref: "HEAD", value });
  }

  /*** Delete a specified branch ***/
  await GitRefManager.deleteRef({ fs: unifiedFs, gitdir, ref: fullRef });

  /*** Delete branch config entries ***/
  const abbrevRef = abbreviateRef(ref);
  const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });

  await config.deleteSection("branch", abbrevRef);
  await GitConfigManager.save({ config, fs: unifiedFs, gitdir });
}

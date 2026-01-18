/**
 * @fileoverview Git delete-tag command implementation
 *
 * Internal implementation of the delete-tag Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/delete-tag.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import type { FsInterface } from "../types.ts";

interface DeleteTagOptions {
  fs: FsInterface;
  gitdir: string;
  ref: string;
}



//// export

/**
 * Delete a local tag ref
 */
export async function _deleteTag({ fs, gitdir, ref }: DeleteTagOptions): Promise<void> {
  const unifiedFs = adaptFsInterface(fs);

  ref = ref.startsWith("refs/tags/") ?
    ref :
    `refs/tags/${ref}`;

  await GitRefManager.deleteRef({ fs: unifiedFs, gitdir, ref });
}

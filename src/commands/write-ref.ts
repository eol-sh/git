/**
 * Internal write ref command
 */

import { GitRefManager } from "../managers/git-ref.ts";
import { FileSystem } from "../models/file-system.ts";

interface WriteRefOptions {
  fs: FileSystem;
  gitdir: string;
  ref: string;
  value: string;
  force?: boolean;
  symbolic?: boolean;
}

/**
 * Internal function to write a ref
 */
export async function _writeRef({
  fs,
  gitdir,
  ref,
  value,
  force = false,
  symbolic = false
}: WriteRefOptions): Promise<void> {
  await GitRefManager.writeRef({
    fs: fs as any,
    gitdir,
    ref,
    value,
    force,
    symbolic
  });
}
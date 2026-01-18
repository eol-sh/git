/**
 * @fileoverview Command for writing Git references to the repository
 * 
 * Implements low-level Git reference writing functionality. Manages both
 * regular and symbolic references, handles force updates, and ensures
 * reference integrity within the Git repository structure.
 * 
 * @module commands/write-ref
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
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
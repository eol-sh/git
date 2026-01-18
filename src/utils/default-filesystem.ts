/**
 * @fileoverview default-filesystem utility functions
 *
 * Utility functions for default-filesystem operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/default-filesystem.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { FileSystem } from "../models/file-system.ts";



//// export

/**
 * Creates a FileSystem instance with default Deno filesystem operations.
 * This eliminates the need to manually configure filesystem for most use cases.
 */
export function createFileSystem(): FileSystem {
  return new FileSystem({
    lstat: Deno.lstat,
    mkdir: Deno.mkdir,
    readdir: Deno.readDir,
    readFile: Deno.readFile,
    readlink: Deno.readLink,
    rmdir: (path: string) => Deno.remove(path, { recursive: false }),
    stat: Deno.stat,
    symlink: Deno.symlink,
    unlink: Deno.remove,
    writeFile: Deno.writeFile
  });
}

/**
 * Default FileSystem instance for Deno.
 * Use this for most operations unless you need custom filesystem behavior.
 */
export const fs = createFileSystem();

/**
 * Alias for the default filesystem
 */
export const defaultFs = fs;

/**
 * Core reset command implementation
 * Implements soft, mixed, and hard reset modes
 */

import { _checkout } from "../commands/checkout.ts";
import { _readObject } from "../storage/read-object.ts";
import { _readTree } from "../commands/read-tree.ts";
import { _resolveRef } from "../commands/resolve-ref.ts";
import { _writeRef } from "../commands/write-ref.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitTree } from "../models/git-tree.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { resolveFilepath } from "../utils/resolve-filepath.ts";

import type { Cache, FsInterface } from "../types.ts";

export type ResetMode = "soft" | "mixed" | "hard";

interface ResetCommandOptions {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  mode: ResetMode;
  ref: string;
  filepath?: string | string[];
}

/**
 * Internal reset command - reset HEAD and optionally index/working tree
 * 
 * Modes:
 * - soft: Only move HEAD, leave index and working tree unchanged
 * - mixed: Move HEAD and reset index, leave working tree unchanged (default)
 * - hard: Move HEAD, reset index AND working tree
 */
export async function _reset({
  cache,
  dir,
  fs,
  gitdir,
  mode = "mixed",
  ref,
  filepath
}: ResetCommandOptions): Promise<void> {
  // Resolve the target commit
  const targetOid = await _resolveRef({ cache, fs, gitdir, ref });
  
  if (!targetOid) {
    throw new NotFoundError(ref);
  }

  // Verify it's a commit
  const { type, object } = await _readObject({ fs, gitdir, oid: targetOid });
  
  if (type !== "commit") {
    throw new ObjectTypeError(targetOid, type, "commit");
  }

  // Get current HEAD
  const currentRef = await GitRefManager.resolve({ 
    fs: fs as any, 
    gitdir, 
    ref: "HEAD",
    depth: 2 
  });

  // If filepath is specified, we're doing a path-specific reset (always mixed mode)
  if (filepath) {
    await resetPaths({
      cache,
      dir,
      fs,
      gitdir,
      targetOid,
      filepath: Array.isArray(filepath) ? filepath : [filepath]
    });
    return;
  }

  // Full reset - move HEAD
  const symbolic = await GitRefManager.isSymbolic({ fs: fs as any, gitdir, ref: "HEAD" });
  
  if (symbolic) {
    // HEAD points to a branch, update the branch ref
    const branch = await GitRefManager.resolve({ 
      fs: fs as any, 
      gitdir, 
      ref: "HEAD",
      depth: 1 
    });
    
    await _writeRef({ 
      fs, 
      gitdir, 
      ref: branch, 
      value: targetOid,
      force: true 
    });
  } else {
    // Detached HEAD, update HEAD directly
    await _writeRef({ 
      fs, 
      gitdir, 
      ref: "HEAD", 
      value: targetOid,
      force: true 
    });
  }

  // Handle different reset modes
  switch (mode) {
    case "soft":
      // Soft reset: only move HEAD, done above
      break;
      
    case "mixed":
      // Mixed reset: move HEAD and reset index
      await resetIndex({
        cache,
        fs,
        gitdir,
        targetOid
      });
      break;
      
    case "hard":
      // Hard reset: move HEAD, reset index, and reset working tree
      await resetIndex({
        cache,
        fs,
        gitdir,
        targetOid
      });
      
      await resetWorkingTree({
        cache,
        dir,
        fs,
        gitdir,
        targetOid
      });
      break;
      
    default:
      throw new Error(`Invalid reset mode: ${mode}`);
  }
}

/**
 * Reset specific paths in the index
 */
async function resetPaths({
  cache,
  dir,
  fs,
  gitdir,
  targetOid,
  filepath
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  targetOid: string;
  filepath: string[];
}): Promise<void> {
  // Get the tree from target commit
  const { object: commitObject } = await _readObject({ fs, gitdir, oid: targetOid });
  const commitText = new TextDecoder().decode(commitObject);
  const treeMatch = commitText.match(/^tree ([0-9a-f]{40})/m);
  
  if (!treeMatch) {
    throw new Error(`Invalid commit object: ${targetOid}`);
  }
  
  const treeOid = treeMatch[1];

  // Update index for each filepath
  await GitIndexManager.acquire(
    { cache, fs: fs as any, gitdir },
    async (index) => {
      for (const path of filepath) {
        // Remove current entry
        index.delete({ filepath: path });
        
        try {
          // Resolve file in target tree
          const fileOid = await resolveFilepath({
            cache,
            filepath: path,
            fs: fs as any,
            gitdir,
            oid: targetOid
          });
          
          if (fileOid) {
            // Get file stats from working directory if it matches
            let stats = {
              ctime: new Date(0),
              dev: 0,
              gid: 0,
              ino: 0,
              mode: 0o100644,
              mtime: new Date(0),
              size: 0,
              uid: 0
            };
            
            const workdirPath = join(dir, path);
            const workdirStat = await fs.lstat(workdirPath);
            
            if (workdirStat) {
              stats = {
                ctime: workdirStat.ctime || new Date(),
                dev: workdirStat.dev || 0,
                gid: workdirStat.gid || 0,
                ino: workdirStat.ino || 0,
                mode: workdirStat.mode || 0o100644,
                mtime: workdirStat.mtime || new Date(),
                size: workdirStat.size || 0,
                uid: workdirStat.uid || 0
              };
            }
            
            // Add to index
            index.insert({ 
              filepath: path, 
              oid: fileOid,
              stats 
            });
          }
        } catch {
          // File doesn't exist in target commit, already deleted from index
        }
      }
    }
  );
}

/**
 * Reset the entire index to match a commit
 */
async function resetIndex({
  cache,
  fs,
  gitdir,
  targetOid
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  targetOid: string;
}): Promise<void> {
  // Get tree from commit
  const { object: commitObject } = await _readObject({ fs, gitdir, oid: targetOid });
  const commitText = new TextDecoder().decode(commitObject);
  const treeMatch = commitText.match(/^tree ([0-9a-f]{40})/m);
  
  if (!treeMatch) {
    throw new Error(`Invalid commit object: ${targetOid}`);
  }
  
  const treeOid = treeMatch[1];
  const tree = await _readTree({ fs, gitdir, oid: treeOid });

  // Clear and rebuild index
  await GitIndexManager.acquire(
    { cache, fs: fs as any, gitdir },
    async (index) => {
      // Clear existing index
      index.clear();
      
      // Add all entries from tree
      await addTreeToIndex(tree, index, "", { fs, gitdir });
    }
  );
}

/**
 * Recursively add tree entries to index
 */
async function addTreeToIndex(
  tree: GitTree,
  index: any,
  prefix: string,
  { fs, gitdir }: { fs: FileSystem; gitdir: string }
): Promise<void> {
  for (const entry of tree.entries()) {
    const filepath = prefix ? join(prefix, entry.path) : entry.path;
    
    if (entry.type === "tree") {
      // Recursively process subtree
      const subtree = await _readTree({ fs, gitdir, oid: entry.oid });
      await addTreeToIndex(subtree, index, filepath, { fs, gitdir });
    } else if (entry.type === "blob") {
      // Add file to index
      index.insert({
        filepath,
        oid: entry.oid,
        stats: {
          ctime: new Date(0),
          dev: 0,
          gid: 0,
          ino: 0,
          mode: parseInt(entry.mode, 8),
          mtime: new Date(0),
          size: 0,
          uid: 0
        }
      });
    }
  }
}

/**
 * Reset working tree to match a commit
 */
async function resetWorkingTree({
  cache,
  dir,
  fs,
  gitdir,
  targetOid
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  targetOid: string;
}): Promise<void> {
  // Use checkout to update working tree
  // This is a simplified version - full implementation would handle more cases
  
  // Get current files in working directory
  const walkDir = async (dirPath: string, basePath = ""): Promise<string[]> => {
    const files: string[] = [];
    const entries = await fs.readdir(dirPath);
    
    if (!entries) return files;
    
    for (const entry of entries) {
      if (entry === ".git") continue;
      
      const fullPath = join(dirPath, entry);
      const relativePath = basePath ? join(basePath, entry) : entry;
      const stat = await fs.lstat(fullPath);
      
      if (stat?.isDirectory()) {
        const subFiles = await walkDir(fullPath, relativePath);
        files.push(...subFiles);
      } else {
        files.push(relativePath);
      }
    }
    
    return files;
  };
  
  const currentFiles = await walkDir(dir);
  
  // Remove all current files
  for (const file of currentFiles) {
    const fullPath = join(dir, file);
    await fs.unlink(fullPath).catch(() => {});
  }
  
  // Checkout files from target commit
  await _checkout({
    cache,
    dir,
    fs,
    gitdir,
    ref: targetOid,
    force: true,
    noCheckout: false
  });
}
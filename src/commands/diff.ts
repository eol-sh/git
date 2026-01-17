/**
 * Core diff command implementation
 */

import { _readObject } from "../storage/read-object.ts";
import { _readTree } from "../commands/read-tree.ts";
import { _resolveRef } from "../commands/resolve-ref.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { createUnifiedDiff, DiffEdit, myersDiff, splitLines } from "../utils/diff-algorithm.ts";
import { DiffResult, FileDiff, Hunk, DiffLine, DiffOptions } from "../models/git-diff.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitTree } from "../models/git-tree.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { posixifyPathBuffer } from "../utils/posixify-path-buffer.ts";

import type { Cache, FsInterface, TreeEntry } from "../types.ts";

interface DiffCommandOptions {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  ref1?: string;
  ref2?: string;
  filepath?: string | string[];
  options?: DiffOptions;
}

interface TreeFile {
  path: string;
  mode: string;
  oid: string;
  type: string;
}

/**
 * Internal diff command - compares two commits, refs, or working tree
 */
export async function _diff({
  cache,
  dir,
  fs,
  gitdir,
  ref1 = "HEAD",
  ref2,
  filepath,
  options = {}
}: DiffCommandOptions): Promise<DiffResult> {
  const {
    unified = 3,
    ignoreWhitespace = false,
    nameOnly = false,
    nameStatus = false
  } = options;

  // Get trees to compare
  const tree1 = await getTreeForRef({ cache, fs, gitdir, ref: ref1 });
  const tree2 = ref2 ? 
    await getTreeForRef({ cache, fs, gitdir, ref: ref2 }) :
    await getWorkingTree({ dir, fs, gitdir, filepath });

  // Get file lists
  const files1 = await flattenTree(tree1);
  const files2 = await flattenTree(tree2);
  
  // Build a map of all unique file paths
  const allPaths = new Set<string>();
  files1.forEach(f => allPaths.add(f.path));
  files2.forEach(f => allPaths.add(f.path));

  // Filter by filepath if provided
  const pathsToCheck = filepath ? 
    (Array.isArray(filepath) ? filepath : [filepath]) :
    Array.from(allPaths);

  const fileDiffs: FileDiff[] = [];
  let totalInsertions = 0;
  let totalDeletions = 0;

  for (const path of pathsToCheck) {
    if (!allPaths.has(path)) continue;

    const file1 = files1.find(f => f.path === path);
    const file2 = files2.find(f => f.path === path);

    // Determine file status
    let status: FileDiff["status"];
    if (!file1 && file2) {
      status = "added";
    } else if (file1 && !file2) {
      status = "deleted";
    } else if (file1 && file2 && file1.oid !== file2.oid) {
      status = "modified";
    } else {
      continue; // No changes
    }

    // For name-only or name-status, we don't need content
    if (nameOnly || nameStatus) {
      fileDiffs.push({
        oldPath: file1?.path || path,
        newPath: file2?.path || path,
        oldMode: file1?.mode,
        newMode: file2?.mode,
        oldOid: file1?.oid,
        newOid: file2?.oid,
        status,
        hunks: []
      });
      continue;
    }

    // Get file contents
    const content1 = file1 ? await getFileContent({ fs, gitdir, oid: file1.oid }) : "";
    const content2 = file2 ? await getFileContent({ fs, gitdir, oid: file2.oid }) : "";

    // Check if binary
    const isBinary = isBinaryContent(content1) || isBinaryContent(content2);

    if (isBinary) {
      fileDiffs.push({
        oldPath: file1?.path || path,
        newPath: file2?.path || path,
        oldMode: file1?.mode,
        newMode: file2?.mode,
        oldOid: file1?.oid,
        newOid: file2?.oid,
        status,
        hunks: [],
        isBinary: true
      });
      continue;
    }

    // Perform diff
    const lines1 = splitLines(content1);
    const lines2 = splitLines(content2);
    
    const edits = myersDiff(lines1, lines2, (a, b) => {
      if (ignoreWhitespace) {
        return a.trim() === b.trim();
      }
      return a === b;
    });

    // Convert to hunks
    const hunks = createHunksFromEdits(lines1, lines2, edits, unified);
    
    // Count changes
    for (const hunk of hunks) {
      for (const line of hunk.lines) {
        if (line.type === "add") totalInsertions++;
        if (line.type === "delete") totalDeletions++;
      }
    }

    fileDiffs.push({
      oldPath: file1?.path || path,
      newPath: file2?.path || path,
      oldMode: file1?.mode,
      newMode: file2?.mode,
      oldOid: file1?.oid,
      newOid: file2?.oid,
      status,
      hunks
    });
  }

  return {
    files: fileDiffs,
    stats: {
      filesChanged: fileDiffs.length,
      insertions: totalInsertions,
      deletions: totalDeletions
    }
  };
}

/**
 * Get tree object for a ref
 */
async function getTreeForRef({
  cache,
  fs,
  gitdir,
  ref
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  ref: string;
}): Promise<GitTree> {
  // Resolve ref to commit oid
  const oid = await _resolveRef({ cache, fs, gitdir, ref });
  
  if (!oid) {
    throw new NotFoundError(ref);
  }

  // Read commit object
  const { type, object } = await _readObject({ fs, gitdir, oid });
  
  if (type !== "commit") {
    throw new ObjectTypeError(oid, type, "commit");
  }

  // Parse commit to get tree oid
  const commitText = new TextDecoder().decode(object);
  const match = commitText.match(/^tree ([0-9a-f]{40})/m);
  
  if (!match) {
    throw new Error(`Invalid commit object: ${oid}`);
  }

  const treeOid = match[1];
  
  // Read and return tree
  return await _readTree({ fs, gitdir, oid: treeOid });
}

/**
 * Get working tree (current file system state)
 */
async function getWorkingTree({
  dir,
  fs,
  gitdir,
  filepath
}: {
  dir: string;
  fs: FileSystem;
  gitdir: string;
  filepath?: string | string[];
}): Promise<GitTree> {
  // For now, we'll read from the index as a proxy for working tree
  // In a full implementation, we'd scan the actual file system
  const entries: TreeEntry[] = [];
  
  // This is a simplified version - full implementation would:
  // 1. Read actual files from disk
  // 2. Compare with index
  // 3. Handle untracked files
  
  return new GitTree(entries);
}

/**
 * Flatten a tree into a list of files
 */
async function flattenTree(tree: GitTree, prefix = ""): Promise<TreeFile[]> {
  const files: TreeFile[] = [];
  
  for (const entry of tree.entries()) {
    const path = prefix ? join(prefix, entry.path) : entry.path;
    
    if (entry.type === "tree") {
      // Recursively flatten subtrees
      // Note: This would need to read the subtree object
      continue;
    } else {
      files.push({
        path,
        mode: entry.mode,
        oid: entry.oid,
        type: entry.type
      });
    }
  }
  
  return files;
}

/**
 * Get file content from object store
 */
async function getFileContent({
  fs,
  gitdir,
  oid
}: {
  fs: FileSystem;
  gitdir: string;
  oid: string;
}): Promise<string> {
  const { type, object } = await _readObject({ fs, gitdir, oid });
  
  if (type !== "blob") {
    throw new ObjectTypeError(oid, type, "blob");
  }
  
  return new TextDecoder().decode(object);
}

/**
 * Check if content is binary
 */
function isBinaryContent(content: string): boolean {
  // Simple heuristic: check for null bytes or high proportion of non-printable chars
  for (let i = 0; i < Math.min(content.length, 8000); i++) {
    const char = content.charCodeAt(i);
    if (char === 0) return true;
    if (char < 32 && char !== 9 && char !== 10 && char !== 13) {
      return true;
    }
  }
  return false;
}

/**
 * Convert diff edits to unified diff hunks
 */
function createHunksFromEdits(
  oldLines: string[],
  newLines: string[],
  edits: DiffEdit[],
  contextLines: number
): Hunk[] {
  const hunks: Hunk[] = [];
  let currentHunk: Hunk | null = null;
  let oldLineNum = 1;
  let newLineNum = 1;

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    
    if (edit.type === "equal") {
      // Add context lines
      const startContext = Math.max(0, edit.oldEnd - contextLines);
      const endContext = Math.min(oldLines.length, edit.oldStart + contextLines);
      
      if (currentHunk) {
        // Add trailing context to current hunk
        for (let j = edit.oldStart; j < Math.min(edit.oldEnd, edit.oldStart + contextLines); j++) {
          currentHunk.lines.push({
            content: oldLines[j],
            type: "context",
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++
          });
        }
        
        // Check if we should start a new hunk
        if (edit.oldEnd - edit.oldStart > contextLines * 2) {
          hunks.push(currentHunk);
          currentHunk = null;
          oldLineNum = edit.oldEnd - contextLines + 1;
          newLineNum = edit.newEnd - contextLines + 1;
        }
      }
    } else {
      // Start new hunk if needed
      if (!currentHunk) {
        const contextStart = Math.max(0, edit.oldStart - contextLines);
        currentHunk = {
          oldStart: contextStart + 1,
          oldLines: 0,
          newStart: contextStart + 1,
          newLines: 0,
          lines: [],
          header: ""
        };
        
        // Add leading context
        for (let j = contextStart; j < edit.oldStart; j++) {
          currentHunk.lines.push({
            content: oldLines[j],
            type: "context",
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++
          });
          currentHunk.oldLines++;
          currentHunk.newLines++;
        }
      }
      
      if (edit.type === "delete") {
        for (let j = edit.oldStart; j < edit.oldEnd; j++) {
          currentHunk.lines.push({
            content: oldLines[j],
            type: "delete",
            oldLineNumber: oldLineNum++,
            newLineNumber: undefined
          });
          currentHunk.oldLines++;
        }
      } else if (edit.type === "insert") {
        for (let j = edit.newStart; j < edit.newEnd; j++) {
          currentHunk.lines.push({
            content: newLines[j],
            type: "add",
            oldLineNumber: undefined,
            newLineNumber: newLineNum++
          });
          currentHunk.newLines++;
        }
      }
    }
  }
  
  if (currentHunk) {
    currentHunk.header = `@@ -${currentHunk.oldStart},${currentHunk.oldLines} +${currentHunk.newStart},${currentHunk.newLines} @@`;
    hunks.push(currentHunk);
  }
  
  return hunks;
}
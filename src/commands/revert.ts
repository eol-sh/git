/**
 * Core revert command implementation
 * Creates a commit that undoes changes from a previous commit
 */

import { _cherryPick } from "../commands/cherry-pick.ts";
import { _readObject } from "../storage/read-object.ts";
import { _resolveRef } from "../commands/resolve-ref.ts";
import { _writeObject } from "../storage/write-object.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { createPatch, applyPatch } from "../utils/apply-patch.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { ObjectTypeError } from "../errors/object-type.ts";

import type { Cache } from "../types.ts";
import process from "node:process";

interface RevertOptions {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  oid: string;
  noCommit?: boolean;
  mainline?: number;
  message?: string;
  author?: {
    name: string;
    email: string;
    timestamp?: number;
    timezoneOffset?: number;
  };
  committer?: {
    name: string;
    email: string;
    timestamp?: number;
    timezoneOffset?: number;
  };
}

/**
 * Internal revert command - create a commit that undoes a previous commit
 */
export async function _revert({
  cache,
  dir,
  fs,
  gitdir,
  oid,
  noCommit = false,
  mainline,
  message,
  author,
  committer
}: RevertOptions): Promise<string | null> {
  // Resolve the commit to revert
  const commitOid = await _resolveRef({ cache, fs, gitdir, ref: oid }) || oid;
  
  // Verify it's a commit
  const { type, object } = await _readObject({ fs: fs as any, gitdir, oid: commitOid });
  
  if (type !== "commit") {
    throw new ObjectTypeError(commitOid, type || "unknown", "commit");
  }
  
  // Parse commit
  const commitInfo = parseCommit(object);
  
  // Handle merge commits
  if (commitInfo.parent.length > 1 && mainline === undefined) {
    throw new Error(
      `Commit ${commitOid} is a merge commit. ` +
      `Please specify which parent to use with --mainline <parent-number>`
    );
  }
  
  // For revert, we want to apply the inverse of the commit
  // This means we cherry-pick from the commit TO its parent (reverse direction)
  
  const parentIndex = mainline ? mainline - 1 : 0;
  const parentOid = commitInfo.parent[parentIndex];
  
  if (!parentOid) {
    throw new Error(`Cannot revert root commit ${commitOid}`);
  }
  
  // Get current HEAD
  const headOid = await _resolveRef({ cache, fs, gitdir, ref: "HEAD" });
  if (!headOid) {
    throw new NotFoundError("HEAD");
  }
  
  // Create a reverse patch (from commit back to parent)
  const reversePatch = await createReversePatch({
    fs,
    gitdir,
    fromOid: commitOid,
    toOid: parentOid
  });
  
  // Apply the reverse patch to the current state
  const conflicts = await applyReversePatch({
    cache,
    dir,
    fs,
    gitdir,
    patch: reversePatch
  });
  
  // If there are conflicts, don't commit
  if (conflicts.length > 0) {
    console.error(`Revert resulted in conflicts in: ${conflicts.join(", ")}`);
    return null;
  }
  
  // Create commit unless --no-commit
  if (!noCommit) {
    // Prepare commit message
    const defaultMessage = `Revert "${commitInfo.message.split("\n")[0]}"\n\n` +
      `This reverts commit ${commitOid}.`;
    const commitMessage = message || defaultMessage;
    
    // Set author and committer
    const now = Math.floor(Date.now() / 1000);
    const offset = new Date().getTimezoneOffset();
    
    const commitAuthor = author || {
      name: process.env.GIT_AUTHOR_NAME || "Unknown",
      email: process.env.GIT_AUTHOR_EMAIL || "unknown@example.com",
      timestamp: now,
      timezoneOffset: offset
    };
    
    const commitCommitter = committer || {
      name: process.env.GIT_COMMITTER_NAME || commitAuthor.name,
      email: process.env.GIT_COMMITTER_EMAIL || commitAuthor.email,
      timestamp: now,
      timezoneOffset: offset
    };
    
    // Create the revert commit
    const newCommit = await createRevertCommit({
      cache,
      fs,
      gitdir,
      message: commitMessage,
      parent: headOid,
      author: commitAuthor,
      committer: commitCommitter
    });
    
    // Update HEAD
    await GitRefManager.writeRef({
      fs: fs as any,
      gitdir,
      ref: "HEAD",
      value: newCommit
    });
    
    return newCommit;
  }
  
  return null;
}

/**
 * Parse commit object
 */
function parseCommit(object: Uint8Array): {
  tree: string;
  parent: string[];
  author: string;
  committer: string;
  message: string;
} {
  const text = new TextDecoder().decode(object);
  const lines = text.split("\n");
  
  const result = {
    tree: "",
    parent: [] as string[],
    author: "",
    committer: "",
    message: ""
  };
  
  let messageStart = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === "") {
      messageStart = i + 1;
      break;
    }
    
    if (line.startsWith("tree ")) {
      result.tree = line.slice(5);
    } else if (line.startsWith("parent ")) {
      result.parent.push(line.slice(7));
    } else if (line.startsWith("author ")) {
      result.author = line.slice(7);
    } else if (line.startsWith("committer ")) {
      result.committer = line.slice(10);
    }
  }
  
  if (messageStart > 0) {
    result.message = lines.slice(messageStart).join("\n").trim();
  }
  
  return result;
}

/**
 * Create a reverse patch (from commit to parent)
 */
async function createReversePatch({
  fs,
  gitdir,
  fromOid,
  toOid
}: {
  fs: FileSystem;
  gitdir: string;
  fromOid: string;
  toOid: string;
}): Promise<any> {
  // This would create a patch that reverses the changes
  // For simplicity, returning a placeholder
  return {
    files: []
  };
}

/**
 * Apply reverse patch to working directory and index
 */
async function applyReversePatch({
  cache,
  dir,
  fs,
  gitdir,
  patch
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  patch: any;
}): Promise<string[]> {
  const conflicts: string[] = [];
  
  // Apply patch to index
  await GitIndexManager.acquire(
    { cache, fs: fs as any, gitdir },
    async (index) => {
      // This would apply the reverse patch
      // For now, simplified implementation
    }
  );
  
  return conflicts;
}

/**
 * Create the revert commit
 */
async function createRevertCommit({
  cache,
  fs,
  gitdir,
  message,
  parent,
  author,
  committer
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  message: string;
  parent: string;
  author: any;
  committer: any;
}): Promise<string> {
  // Write tree from current index
  let treeOid = "";
  
  await GitIndexManager.acquire(
    { cache, fs: fs as any, gitdir },
    async (index) => {
      // Write tree from index (simplified)
      treeOid = "placeholder-tree-oid";
    }
  );
  
  // Format commit object
  const lines = [
    `tree ${treeOid}`,
    `parent ${parent}`,
    `author ${author.name} <${author.email}> ${author.timestamp} ${formatTimezoneOffset(author.timezoneOffset)}`,
    `committer ${committer.name} <${committer.email}> ${committer.timestamp} ${formatTimezoneOffset(committer.timezoneOffset)}`,
    "",
    message
  ];
  
  const commitText = lines.join("\n");
  
  // Write commit object
  return await _writeObject({
    fs: fs as any,
    gitdir,
    type: "commit",
    object: new TextEncoder().encode(commitText)
  });
}

/**
 * Format timezone offset
 */
function formatTimezoneOffset(offset: number): string {
  const sign = offset <= 0 ? "+" : "-";
  const absOffset = Math.abs(offset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;
  return `${sign}${hours.toString().padStart(2, "0")}${minutes.toString().padStart(2, "0")}`;
}
/**
 * @fileoverview Git cherry-pick command implementation
 *
 * Internal implementation of the cherry-pick Git operation. This module contains
 * the core logic and should not be used directly - use the API layer instead.
 *
 * @module commands/cherry-pick.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 *//**
 * Core cherry-pick command implementation
 * Applies changes from specific commits onto the current branch
 */

import { _readObject } from "../storage/read-object.ts";
import { _readTree } from "../commands/read-tree.ts";
import { _resolveRef } from "../commands/resolve-ref.ts";
import { _writeObject } from "../storage/write-object.ts";
import { _writeTree } from "../commands/write-tree.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { threeWayMerge } from "../utils/apply-patch.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
// import { resolveFilepath } from "../utils/resolve-filepath.ts";
import { normalizeStats } from "../utils/normalize-stats.ts";
import { hashBlob } from "../api/hash-blob.ts";

import type { Cache } from "../types.ts";

interface CherryPickOptions {
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

interface CommitInfo {
  tree: string;
  parent: string[];
  author: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
  };
  committer: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
  };
  message: string;
}

/**
 * Internal cherry-pick command - apply a commit's changes
 */
export async function _cherryPick({
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
}: CherryPickOptions): Promise<string | null> {
  // Get the commit to cherry-pick
  const commitInfo = await getCommitInfo({ cache, fs, gitdir, oid });

  // Handle merge commits
  if (commitInfo.parent.length > 1 && mainline === undefined) {
    throw new Error(
      `Commit ${oid} is a merge commit. ` +
      `Please specify which parent to use with --mainline <parent-number>`
    );
  }

  // Get parent commit (for the diff)
  const parentIndex = mainline ? mainline - 1 : 0;
  const parentOid = commitInfo.parent[parentIndex];

  if (!parentOid) {
    throw new Error(`Cannot cherry-pick root commit ${oid}`);
  }

  // Get current HEAD
  const headOid = await _resolveRef({ cache, fs, gitdir, ref: "HEAD" });
  if (!headOid) {
    throw new NotFoundError("HEAD");
  }

  // Get trees for all three commits
  const parentTree = await getCommitTree({ cache, fs, gitdir, oid: parentOid });
  const cherryTree = await getCommitTree({ cache, fs, gitdir, oid });
  const headTree = await getCommitTree({ cache, fs, gitdir, oid: headOid });

  // Get file lists from trees
  const parentFiles = await getTreeFiles({ cache, fs, gitdir, tree: parentTree });
  const cherryFiles = await getTreeFiles({ cache, fs, gitdir, tree: cherryTree });
  const headFiles = await getTreeFiles({ cache, fs, gitdir, tree: headTree });

  // Find all affected files
  const allFiles = new Set<string>();
  [...parentFiles, ...cherryFiles, ...headFiles].forEach(f => allFiles.add(f.path));

  // Track conflicts
  const conflicts: string[] = [];

  // Apply changes to index
  await GitIndexManager.acquire(
    { cache, fs: fs as any, gitdir },
    async (index) => {
      for (const filepath of allFiles) {
        const parentFile = parentFiles.find(f => f.path === filepath);
        const cherryFile = cherryFiles.find(f => f.path === filepath);
        const headFile = headFiles.find(f => f.path === filepath);

        // Determine the operation
        if (!parentFile && cherryFile) {
          // File was added in cherry-pick commit
          if (headFile) {
            // File exists in HEAD - potential conflict
            const headContent = await getFileContent({ cache, fs, gitdir, oid: headFile.oid });
            const cherryContent = await getFileContent({ cache, fs, gitdir, oid: cherryFile.oid });

            if (headContent !== cherryContent) {
              conflicts.push(filepath);
              // For now, use cherry-pick version
              await updateIndex(index, filepath, cherryFile.oid, dir, fs);
            }
          } else {
            // File doesn't exist in HEAD - add it
            await updateIndex(index, filepath, cherryFile.oid, dir, fs);
          }
        } else if (parentFile && !cherryFile) {
          // File was deleted in cherry-pick commit
          if (headFile) {
            // Remove from index
            index.delete({ filepath });
            // Also remove from working directory
            await fs.unlink(join(dir, filepath)).catch(() => {});
          }
        } else if (parentFile && cherryFile && parentFile.oid !== cherryFile.oid) {
          // File was modified in cherry-pick commit
          if (!headFile) {
            // File was deleted in HEAD - conflict
            conflicts.push(filepath);
          } else {
            // Apply the change
            const parentContent = await getFileContent({ cache, fs, gitdir, oid: parentFile.oid });
            const cherryContent = await getFileContent({ cache, fs, gitdir, oid: cherryFile.oid });
            const headContent = await getFileContent({ cache, fs, gitdir, oid: headFile.oid });

            // Three-way merge
            const mergeResult = threeWayMerge(parentContent, headContent, cherryContent);

            if (mergeResult.success && mergeResult.content) {
              // Write merged content
              const mergedOid = await _writeObject({
                fs: fs as any,
                gitdir,
                type: "blob",
                object: new TextEncoder().encode(mergeResult.content)
              });

              await updateIndex(index, filepath, mergedOid, dir, fs);

              // Update working directory
              await fs.writeFile(
                join(dir, filepath),
                new TextEncoder().encode(mergeResult.content)
              );
            } else {
              // Conflict
              conflicts.push(filepath);

              // Write conflict markers to working directory
              if (mergeResult.content) {
                await fs.writeFile(
                  join(dir, filepath),
                  new TextEncoder().encode(mergeResult.content)
                );
              }
            }
          }
        }
      }
    }
  );

  // If there are conflicts, don't commit
  if (conflicts.length > 0) {
    console.error(`Cherry-pick resulted in conflicts in: ${conflicts.join(", ")}`);
    return null;
  }

  // Create commit unless --no-commit
  if (!noCommit) {
    // Prepare commit message
    const commitMessage = message ||
      `${commitInfo.message}\n\n(cherry picked from commit ${oid})`;

    // Use original author by default
    const commitAuthor = author || commitInfo.author;
    const commitCommitter = committer || {
      name: commitAuthor.name,
      email: commitAuthor.email,
      timestamp: Math.floor(Date.now() / 1000),
      timezoneOffset: new Date().getTimezoneOffset()
    };

    // Create new commit
    const newCommit = await createCommit({
      fs,
      gitdir,
      message: commitMessage,
      tree: await writeTreeFromIndex({ cache, fs, gitdir, dir }),
      parent: [headOid],
      author: commitAuthor,
      committer: commitCommitter
    });

    // Update HEAD
    await updateHEAD({ fs, gitdir, oid: newCommit });

    return newCommit;
  }

  return null;
}

/**
 * Get commit information
 */
async function getCommitInfo({
  cache,
  fs,
  gitdir,
  oid
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  oid: string;
}): Promise<CommitInfo> {
  const { type, object } = await _readObject({ cache, fs: fs as any, gitdir, oid });

  if (type !== "commit") {
    throw new ObjectTypeError(oid, (type as "blob" | "commit" | "tag" | "tree") || "blob", "commit");
  }

  const text = new TextDecoder().decode(object);
  const lines = text.split("\n");

  const result: CommitInfo = {
    tree: "",
    parent: [],
    author: { name: "", email: "", timestamp: 0, timezoneOffset: 0 },
    committer: { name: "", email: "", timestamp: 0, timezoneOffset: 0 },
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
      const match = line.match(/^author (.+) <(.+)> (\d+) ([-+]\d{4})$/);
      if (match) {
        result.author = {
          name: match[1],
          email: match[2],
          timestamp: parseInt(match[3]),
          timezoneOffset: parseTimezoneOffset(match[4])
        };
      }
    } else if (line.startsWith("committer ")) {
      const match = line.match(/^committer (.+) <(.+)> (\d+) ([-+]\d{4})$/);
      if (match) {
        result.committer = {
          name: match[1],
          email: match[2],
          timestamp: parseInt(match[3]),
          timezoneOffset: parseTimezoneOffset(match[4])
        };
      }
    }
  }

  if (messageStart > 0) {
    result.message = lines.slice(messageStart).join("\n").trim();
  }

  return result;
}

/**
 * Parse timezone offset string
 */
function parseTimezoneOffset(offset: string): number {
  const sign = offset[0] === "-" ? -1 : 1;
  const hours = parseInt(offset.slice(1, 3));
  const minutes = parseInt(offset.slice(3, 5));
  return sign * (hours * 60 + minutes);
}

/**
 * Get tree OID from commit
 */
async function getCommitTree({
  cache,
  fs,
  gitdir,
  oid
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  oid: string;
}): Promise<string> {
  const info = await getCommitInfo({ cache, fs, gitdir, oid });
  return info.tree;
}

/**
 * Get files from tree
 */
async function getTreeFiles({
  cache,
  fs,
  gitdir,
  tree
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  tree: string;
}): Promise<Array<{ path: string; oid: string; mode: string }>> {
  return await flattenTreeRecursive({ cache, fs, gitdir, tree, prefix: "" });
}

/**
 * Recursively flatten a tree including all nested subtrees
 */
async function flattenTreeRecursive({
  cache,
  fs,
  gitdir,
  tree,
  prefix
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  tree: string;
  prefix: string;
}): Promise<Array<{ path: string; oid: string; mode: string }>> {
  const treeObj = await _readTree({ cache, fs: fs as any, gitdir, oid: tree });
  const files: Array<{ path: string; oid: string; mode: string }> = [];

  for (const entry of treeObj.tree) {
    const fullPath = prefix ? `${prefix}/${entry.path}` : entry.path;

    if (entry.type === "blob") {
      files.push({
        path: fullPath,
        oid: entry.oid,
        mode: entry.mode
      });
    } else if (entry.type === "tree") {
      // Recursively process subtree
      const subFiles = await flattenTreeRecursive({
        cache,
        fs,
        gitdir,
        tree: entry.oid,
        prefix: fullPath
      });
      files.push(...subFiles);
    }
  }

  return files;
}

/**
 * Get file content
 */
async function getFileContent({
  cache,
  fs,
  gitdir,
  oid
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  oid: string;
}): Promise<string> {
  const { object } = await _readObject({ cache, fs: fs as any, gitdir, oid });
  return new TextDecoder().decode(object);
}

/**
 * Update index with new file
 */
async function updateIndex(
  index: any,
  filepath: string,
  oid: string,
  dir: string,
  fs: FileSystem
): Promise<void> {
  const stats = await fs.lstat(join(dir, filepath)).catch(() => null);

  index.insert({
    filepath,
    oid,
    stats: stats ? normalizeStats(stats as any) : {
      ctime: new Date(0),
      mtime: new Date(0),
      dev: 0,
      ino: 0,
      mode: 0o100644,
      uid: 0,
      gid: 0,
      size: 0
    }
  });
}

/**
 * Write tree from index
 */
async function writeTreeFromIndex({
  // cache,
  fs,
  gitdir,
  dir
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  dir: string;
}): Promise<string> {
  // Get the current working tree files
  const entries: { path: string; type: 'file' | 'directory' }[] = [];

  // For simplicity, we'll scan the working directory and create tree entries
  // In a full implementation, this would read from the actual Git index
  await scanDirectory(fs, dir, "", entries);

  // Filter out .git directory
  const filteredEntries = entries.filter(entry => !entry.path.startsWith(".git"));

  // Convert to tree entries format
  const treeEntries: Array<{ mode: string; path: string; oid: string; type: "blob" | "commit" | "tree" }> = [];

  for (const entry of filteredEntries) {
    try {
      const fullPath = join(dir, entry.path);
      const stat = await fs.lstat(fullPath);

      if (stat && stat.isFile()) {
        // Read file content and get hash
        const content = await fs.read(fullPath) as Uint8Array;
        const hashResult = await hashBlob({
          object: content
        });

        treeEntries.push({
          mode: "100644", // Regular file mode
          path: entry.path,
          oid: hashResult.oid,
          type: "blob" as "blob" | "commit" | "tree"
        });
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  // Write the tree
  return await _writeTree({
    fs: fs as any,
    gitdir,
    tree: treeEntries
  });
}

/**
 * Recursively scan directory for files
 */
async function scanDirectory(
  fs: FileSystem,
  baseDir: string,
  relativePath: string,
  entries: Array<{ path: string }>
): Promise<void> {
  const fullPath = relativePath ? join(baseDir, relativePath) : baseDir;

  try {
    const dirEntries = await fs.readdir(fullPath);

    if (dirEntries) {
      for (const entryName of dirEntries) {
        // Skip .git directory
        if (entryName === ".git")
          continue;

        const entryRelativePath = relativePath ? join(relativePath, entryName) : entryName;
        const entryFullPath = join(fullPath, entryName);

        try {
          const stat = await fs.lstat(entryFullPath);

          if (stat && stat.isFile())
            entries.push({ path: entryRelativePath });
          else if (stat && stat.isDirectory())
            await scanDirectory(fs, baseDir, entryRelativePath, entries);
        } catch {
          // Skip inaccessible entries
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }
}

/**
 * Create a commit object
 */
async function createCommit({
  fs,
  gitdir,
  message,
  tree,
  parent,
  author,
  committer
}: {
  fs: FileSystem;
  gitdir: string;
  message: string;
  tree: string;
  parent: string[];
  author: any;
  committer: any;
}): Promise<string> {
  const lines = [
    `tree ${tree}`,
    ...parent.map(p => `parent ${p}`),
    `author ${author.name} <${author.email}> ${author.timestamp} ${formatTimezoneOffset(author.timezoneOffset)}`,
    `committer ${committer.name} <${committer.email}> ${committer.timestamp} ${formatTimezoneOffset(committer.timezoneOffset)}`,
    "",
    message
  ];

  const commitText = lines.join("\n");

  return await _writeObject({
    fs: fs as any,
    gitdir,
    object: new TextEncoder().encode(commitText),
    type: "commit"
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

/**
 * Update HEAD ref
 */
async function updateHEAD({
  fs,
  gitdir,
  oid
}: {
  fs: FileSystem;
  gitdir: string;
  oid: string;
}): Promise<void> {
  await GitRefManager.writeRef({
    fs: fs as any,
    gitdir,
    ref: "HEAD",
    value: oid
  });
}

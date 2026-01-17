/**
 * Core blame command implementation
 * Tracks line-by-line authorship information
 */

import { _readObject } from "../storage/read-object.ts";
import { _resolveRef } from "../commands/resolve-ref.ts";
import { _walk } from "../commands/walk.ts";
import { FileSystem } from "../models/file-system.ts";
import { BlameResult, BlameLine, BlameOptions } from "../models/git-blame.ts";
import { myersDiff, splitLines } from "../utils/diff-algorithm.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { TREE } from "../api/tree.ts";
import { resolveFilepath } from "../utils/resolve-filepath.ts";

import type { Cache } from "../types.ts";

interface BlameCommandOptions {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  ref?: string;
  filepath: string;
  options?: BlameOptions;
}

interface CommitInfo {
  oid: string;
  author: string;
  authorEmail: string;
  authorTime: number;
  authorTimezone: string;
  committer: string;
  committerEmail: string;
  committerTime: number;
  committerTimezone: string;
  message: string;
  tree: string;
  parent: string[];
}

interface LineBlame {
  lineNumber: number;
  content: string;
  commit: CommitInfo;
  originalLine: number;
}

/**
 * Internal blame command - track line authorship
 */
export async function _blame({
  cache,
  fs,
  gitdir,
  ref = "HEAD",
  filepath,
  options = {}
}: BlameCommandOptions): Promise<BlameResult> {
  const {
    startLine,
    endLine,
    reverse = false,
    firstParent = false
  } = options;

  // Resolve ref to commit oid
  const headOid = await _resolveRef({ cache, fs, gitdir, ref });
  if (!headOid) {
    throw new NotFoundError(ref);
  }

  // Get the current file content
  const currentContent = await getFileAtCommit({
    cache,
    fs,
    gitdir,
    oid: headOid,
    filepath
  });

  if (!currentContent) {
    throw new NotFoundError(filepath);
  }

  const lines = splitLines(currentContent);
  
  // Initialize blame for each line
  const lineBlames: LineBlame[] = lines.map((content, idx) => ({
    lineNumber: idx + 1,
    content,
    commit: null as any, // Will be filled during walk
    originalLine: idx + 1
  }));

  // Walk through commit history
  const commits = await getCommitHistory({
    cache,
    fs,
    gitdir,
    startOid: headOid,
    filepath,
    firstParent
  });

  // Process commits to find line origins
  await processBlameHistory({
    cache,
    fs,
    gitdir,
    commits,
    filepath,
    lineBlames
  });

  // Filter by line range if specified
  let resultLines = lineBlames;
  if (startLine !== undefined || endLine !== undefined) {
    const start = (startLine || 1) - 1;
    const end = endLine || lines.length;
    resultLines = lineBlames.slice(start, end);
  }

  // Convert to BlameResult format
  const blameLines: BlameLine[] = resultLines.map(blame => ({
    oid: blame.commit.oid,
    originalLineNumber: blame.originalLine,
    finalLineNumber: blame.lineNumber,
    content: blame.content,
    author: blame.commit.author,
    authorEmail: blame.commit.authorEmail,
    authorTime: blame.commit.authorTime,
    authorTimezone: blame.commit.authorTimezone,
    committer: blame.commit.committer,
    committerEmail: blame.commit.committerEmail,
    committerTime: blame.commit.committerTime,
    committerTimezone: blame.commit.committerTimezone,
    summary: blame.commit.message.split("\n")[0],
    filename: filepath
  }));

  return {
    lines: reverse ? blameLines.reverse() : blameLines
  };
}

/**
 * Get file content at a specific commit
 */
async function getFileAtCommit({
  cache,
  fs,
  gitdir,
  oid,
  filepath
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  oid: string;
  filepath: string;
}): Promise<string | null> {
  try {
    // Resolve file in commit tree
    const fileOid = await resolveFilepath({
      cache,
      fs: fs as any,
      gitdir,
      oid,
      filepath
    });

    if (!fileOid) {
      return null;
    }

    // Read file content
    const { object } = await _readObject({ 
      fs: fs as any, 
      gitdir, 
      oid: fileOid 
    });

    return new TextDecoder().decode(object);
  } catch {
    return null;
  }
}

/**
 * Get commit history for a file
 */
async function getCommitHistory({
  cache,
  fs,
  gitdir,
  startOid,
  filepath,
  firstParent
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  startOid: string;
  filepath: string;
  firstParent: boolean;
}): Promise<CommitInfo[]> {
  const commits: CommitInfo[] = [];
  const seen = new Set<string>();

  // Walk commit history
  await _walk({
    cache,
    fs: fs as any,
    gitdir,
    trees: [TREE({ ref: startOid })],
    map: async function(filepath: string, entries: any[]) {
      if (entries[0] && !seen.has(entries[0].oid)) {
        seen.add(entries[0].oid);
        const commit = await parseCommit({
          fs,
          gitdir,
          oid: entries[0].oid
        });
        commits.push(commit);
      }
    }
  });

  return commits;
}

/**
 * Parse commit object
 */
async function parseCommit({
  fs,
  gitdir,
  oid
}: {
  fs: FileSystem;
  gitdir: string;
  oid: string;
}): Promise<CommitInfo> {
  const { object } = await _readObject({ 
    fs: fs as any, 
    gitdir, 
    oid 
  });

  const text = new TextDecoder().decode(object);
  const lines = text.split("\n");
  
  const result: CommitInfo = {
    oid,
    author: "",
    authorEmail: "",
    authorTime: 0,
    authorTimezone: "",
    committer: "",
    committerEmail: "",
    committerTime: 0,
    committerTimezone: "",
    message: "",
    tree: "",
    parent: []
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
        result.author = match[1];
        result.authorEmail = match[2];
        result.authorTime = parseInt(match[3]);
        result.authorTimezone = match[4];
      }
    } else if (line.startsWith("committer ")) {
      const match = line.match(/^committer (.+) <(.+)> (\d+) ([-+]\d{4})$/);
      if (match) {
        result.committer = match[1];
        result.committerEmail = match[2];
        result.committerTime = parseInt(match[3]);
        result.committerTimezone = match[4];
      }
    }
  }
  
  if (messageStart > 0) {
    result.message = lines.slice(messageStart).join("\n").trim();
  }
  
  return result;
}

/**
 * Process blame history to find line origins
 */
async function processBlameHistory({
  cache,
  fs,
  gitdir,
  commits,
  filepath,
  lineBlames
}: {
  cache: Cache;
  fs: FileSystem;
  gitdir: string;
  commits: CommitInfo[];
  filepath: string;
  lineBlames: LineBlame[];
}): Promise<void> {
  // This is a simplified blame algorithm
  // A full implementation would track line movements through diffs
  
  // For now, assign the most recent commit that modified the file
  if (commits.length > 0) {
    // Simple approach: assign first commit to all lines
    const latestCommit = commits[0];
    
    for (const blame of lineBlames) {
      if (!blame.commit) {
        blame.commit = latestCommit;
      }
    }
    
    // More sophisticated: try to find when each line was introduced
    // by comparing with parent commits
    for (let i = 0; i < commits.length - 1; i++) {
      const commit = commits[i];
      const parentCommit = commits[i + 1];
      
      const currentContent = await getFileAtCommit({
        cache,
        fs,
        gitdir,
        oid: commit.oid,
        filepath
      });
      
      const parentContent = await getFileAtCommit({
        cache,
        fs,
        gitdir,
        oid: parentCommit.oid,
        filepath
      });
      
      if (!currentContent || !parentContent) continue;
      
      const currentLines = splitLines(currentContent);
      const parentLines = splitLines(parentContent);
      
      // Use diff to find added lines
      const edits = myersDiff(parentLines, currentLines);
      
      for (const edit of edits) {
        if (edit.type === "insert") {
          // Lines added in this commit
          for (let j = edit.newStart; j < edit.newEnd; j++) {
            const lineNum = j + 1;
            const blame = lineBlames.find(b => b.lineNumber === lineNum);
            if (blame && (!blame.commit || blame.commit.oid === latestCommit.oid)) {
              blame.commit = commit;
              blame.originalLine = j + 1;
            }
          }
        }
      }
    }
  }
}
/**
 * @fileoverview reflog utility functions
 *
 * Utility functions for reflog operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/reflog.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
 * Git reflog utilities
 *
 * Implementation of reference log tracking for HEAD and branch references
 */

import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

export interface ReflogEntry {
  oldOid: string;
  newOid: string;
  committer: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
  };
  message: string;
}

export interface ReflogOptions {
  fs: FileSystem;
  gitdir: string;
  ref?: string;
  limit?: number;
}

/**
 * Read reflog entries for a reference
 */
export async function readReflog({
  fs,
  gitdir,
  ref = "HEAD",
  limit
}: ReflogOptions): Promise<ReflogEntry[]> {
  const reflogPath = getReflogPath(gitdir, ref);

  try {
    const content = new TextDecoder().decode(await fs.read(reflogPath) as Uint8Array);
    const lines = content.trim().split("\n").filter(line => line.trim());

    const entries = lines.map(parseReflogLine).filter(entry => entry !== null) as ReflogEntry[];

    // Return entries in reverse chronological order (newest first)
    entries.reverse();

    if (limit && limit > 0) {
      return entries.slice(0, limit);
    }

    return entries;
  } catch {
    // Reflog file doesn't exist
    return [];
  }
}

/**
 * Write a reflog entry
 */
export async function writeReflogEntry({
  fs,
  gitdir,
  ref = "HEAD",
  oldOid,
  newOid,
  committer,
  message
}: {
  fs: FileSystem;
  gitdir: string;
  ref?: string;
  oldOid: string;
  newOid: string;
  committer: {
    name: string;
    email: string;
    timestamp: number;
    timezoneOffset: number;
  };
  message: string;
}): Promise<void> {
  const reflogPath = getReflogPath(gitdir, ref);
  const reflogDir = reflogPath.substring(0, reflogPath.lastIndexOf("/"));

  // Ensure reflog directory exists
  await fs.mkdir(reflogDir);

  // Format reflog line
  const line = formatReflogLine({
    oldOid,
    newOid,
    committer,
    message
  });

  // Append to reflog file
  try {
    const existingContent = await fs.exists(reflogPath) ? new TextDecoder().decode(await fs.read(reflogPath) as Uint8Array) : "";
    await fs.write(reflogPath, existingContent + line + "\n");
  } catch {
    // File doesn't exist, create it
    await fs.write(reflogPath, line + "\n");
  }
}

/**
 * Get all reflog references
 */
export async function listReflogs({
  fs,
  gitdir
}: {
  fs: FileSystem;
  gitdir: string;
}): Promise<string[]> {
  const reflogsDir = join(gitdir, "logs");

  try {
    const refs: string[] = [];

    // Check for HEAD reflog
    const headReflogPath = join(reflogsDir, "HEAD");
    if (await fs.exists(headReflogPath)) {
      refs.push("HEAD");
    }

    // Check for refs/heads/* reflogs
    const refsHeadsDir = join(reflogsDir, "refs", "heads");
    if (await fs.exists(refsHeadsDir)) {
      const branches = await fs.readdir(refsHeadsDir);
      if (branches) {
        for (const branch of branches) {
          refs.push(`refs/heads/${branch}`);
        }
      }
    }

    // Check for refs/remotes/* reflogs
    const refsRemotesDir = join(reflogsDir, "refs", "remotes");
    if (await fs.exists(refsRemotesDir)) {
      const remotes = await fs.readdir(refsRemotesDir);
      if (remotes) {
        for (const remote of remotes) {
          const remotePath = join(refsRemotesDir, remote);
          const remoteBranches = await fs.readdir(remotePath);
          if (remoteBranches) {
            for (const branch of remoteBranches) {
              refs.push(`refs/remotes/${remote}/${branch}`);
            }
          }
        }
      }
    }

    return refs;
  } catch {
    return [];
  }
}

/**
 * Delete reflog for a reference
 */
export async function deleteReflog({
  fs,
  gitdir,
  ref
}: {
  fs: FileSystem;
  gitdir: string;
  ref: string;
}): Promise<void> {
  const reflogPath = getReflogPath(gitdir, ref);

  try {
    await fs.rm(reflogPath);
  } catch {
    // File doesn't exist, that's fine
  }
}

/**
 * Expire old reflog entries based on time or count
 */
export async function expireReflog({
  fs,
  gitdir,
  ref = "HEAD",
  expireTime,
  maxCount
}: {
  fs: FileSystem;
  gitdir: string;
  ref?: string;
  expireTime?: number; // Timestamp - entries older than this will be removed
  maxCount?: number; // Maximum number of entries to keep
}): Promise<void> {
  const entries = await readReflog({ fs, gitdir, ref });

  if (entries.length === 0) {
    return;
  }

  let filteredEntries = entries;

  // Filter by time if specified
  if (expireTime) {
    filteredEntries = filteredEntries.filter(entry =>
      entry.committer.timestamp >= expireTime
    );
  }

  // Limit by count if specified
  if (maxCount && maxCount > 0) {
    filteredEntries = filteredEntries.slice(0, maxCount);
  }

  // Rewrite reflog file
  const reflogPath = getReflogPath(gitdir, ref);

  if (filteredEntries.length === 0) {
    // Remove file entirely
    await deleteReflog({ fs, gitdir, ref });
  } else {
    // Write filtered entries (in chronological order)
    const lines = filteredEntries.reverse().map(entry => formatReflogLine(entry));
    await fs.write(reflogPath, lines.join("\n") + "\n");
  }
}

/**
 * Get reflog path for a reference
 */
function getReflogPath(gitdir: string, ref: string): string {
  if (ref === "HEAD") {
    return join(gitdir, "logs", "HEAD");
  }

  // Handle refs/heads/branch-name format
  if (ref.startsWith("refs/")) {
    return join(gitdir, "logs", ref);
  }

  // Assume it's a branch name
  return join(gitdir, "logs", "refs", "heads", ref);
}

/**
 * Parse a reflog line
 */
function parseReflogLine(line: string): ReflogEntry | null {
  // Format: <old-oid> <new-oid> <committer> <message>
  // Example: abc123 def456 John Doe <john@example.com> 1234567890 +0000	commit: Initial commit

  const match = line.match(/^([a-f0-9]{40}) ([a-f0-9]{40}) (.+?) (\d+) ([\+\-]\d{4})\t(.*)$/);

  if (!match) {
    return null;
  }

  const [, oldOid, newOid, committerInfo, timestamp, timezone, message] = match;

  // Parse committer info
  const committerMatch = committerInfo.match(/^(.+) <(.+)>$/);
  if (!committerMatch) {
    return null;
  }

  const [, name, email] = committerMatch;

  // Parse timezone offset
  const timezoneOffset = parseInt(timezone.substring(1, 3)) * 60 + parseInt(timezone.substring(3, 5));
  const finalTimezoneOffset = timezone.startsWith("-") ? -timezoneOffset : timezoneOffset;

  return {
    oldOid,
    newOid,
    committer: {
      name,
      email,
      timestamp: parseInt(timestamp),
      timezoneOffset: finalTimezoneOffset
    },
    message
  };
}

/**
 * Format a reflog entry as a line
 */
function formatReflogLine(entry: ReflogEntry): string {
  const { oldOid, newOid, committer, message } = entry;
  const { name, email, timestamp, timezoneOffset } = committer;

  // Format timezone
  const absOffset = Math.abs(timezoneOffset);
  const hours = Math.floor(absOffset / 60);
  const minutes = absOffset % 60;
  const sign = timezoneOffset >= 0 ? "+" : "-";
  const formattedTimezone = `${sign}${hours.toString().padStart(2, "0")}${minutes.toString().padStart(2, "0")}`;

  return `${oldOid} ${newOid} ${name} <${email}> ${timestamp} ${formattedTimezone}\t${message}`;
}

/**
 * Get reflog entry by index (HEAD@{n} syntax)
 */
export async function getReflogEntry({
  fs,
  gitdir,
  ref = "HEAD",
  index = 0
}: {
  fs: FileSystem;
  gitdir: string;
  ref?: string;
  index?: number;
}): Promise<ReflogEntry | null> {
  const entries = await readReflog({ fs, gitdir, ref });

  if (index < 0 || index >= entries.length) {
    return null;
  }

  return entries[index];
}

/**
 * Resolve a reflog reference (e.g., HEAD@{2} -> commit oid)
 */
export async function resolveReflogRef({
  fs,
  gitdir,
  ref
}: {
  fs: FileSystem;
  gitdir: string;
  ref: string;
}): Promise<string | null> {
  // Parse ref@{n} syntax
  const match = ref.match(/^(.+)@\{(\d+)\}$/);

  if (!match) {
    // Not a reflog reference
    return null;
  }

  const [, baseName, indexStr] = match;
  const index = parseInt(indexStr);

  const entry = await getReflogEntry({
    fs,
    gitdir,
    ref: baseName,
    index
  });

  return entry ? entry.newOid : null;
}

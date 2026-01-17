/**
 * Git grep utilities
 *
 * Implementation of pattern searching in git repository content
 */

import { FileSystem } from "../models/file-system.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { readBlob } from "../api/read-blob.ts";
import { readTree } from "../api/read-tree.ts";
import { readCommit } from "../api/read-commit.ts";
import { resolveRef } from "../api/resolve-ref.ts";
import { join } from "../utils/join.ts";

export interface GrepMatch {
  file: string;
  line: number;
  column: number;
  content: string;
  match: string;
}

export interface GrepResult {
  matches: GrepMatch[];
  fileCount: number;
  totalMatches: number;
}

export interface GrepOptions {
  fs: FileSystem;
  dir: string;
  gitdir: string;
  pattern: string | RegExp;
  ref?: string; // Commit/tree to search in (default: working directory)
  paths?: string[]; // Specific paths to search
  ignoreCase?: boolean;
  wholeWord?: boolean;
  lineNumber?: boolean;
  invertMatch?: boolean;
  maxCount?: number; // Maximum matches per file
  contextLines?: number; // Lines of context around matches
  filenameOnly?: boolean; // Only show filenames, not match content
  cache?: Map<string, any>;
}

/**
 * Search for patterns in repository files
 */
export async function grep({
  fs,
  dir,
  gitdir,
  pattern,
  ref,
  paths,
  ignoreCase = false,
  wholeWord = false,
  lineNumber = true,
  invertMatch = false,
  maxCount,
  contextLines = 0,
  filenameOnly = false,
  cache = new Map()
}: GrepOptions): Promise<GrepResult> {
  const regex = createSearchRegex(pattern, { ignoreCase, wholeWord });
  const adaptedFs = adaptFileSystem(fs);

  let filesToSearch: Array<{ path: string; oid?: string }>;

  if (ref) {
    // Search in a specific commit/tree
    filesToSearch = await getFilesFromRef(fs, adaptedFs, gitdir, ref, paths, cache);
  } else {
    // Search in working directory
    filesToSearch = await getFilesFromWorkingDirectory(fs, dir, paths);
  }

  const allMatches: GrepMatch[] = [];
  const matchedFiles = new Set<string>();

  for (const { path, oid } of filesToSearch) {
    let content: string;

    if (oid) {
      // Read from git object
      const blob = await readBlob({
        fs: adaptedFs,
        gitdir,
        oid
      });
      content = new TextDecoder().decode(blob.blob);
    } else {
      // Read from working directory
      try {
        content = new TextDecoder().decode(await fs.read(join(dir, path)) as Uint8Array);
      } catch {
        // File might not exist or be binary
        continue;
      }
    }

    const matches = searchInContent(
      content,
      regex,
      path,
      {
        lineNumber,
        invertMatch,
        ...(maxCount !== undefined ? { maxCount } : {}),
        contextLines,
        filenameOnly
      }
    );

    if (matches.length > 0) {
      allMatches.push(...matches);
      matchedFiles.add(path);
    }
  }

  return {
    matches: allMatches,
    fileCount: matchedFiles.size,
    totalMatches: allMatches.length
  };
}

/**
 * Search for patterns in a single file content
 */
function searchInContent(
  content: string,
  regex: RegExp,
  filepath: string,
  options: {
    lineNumber: boolean;
    invertMatch: boolean;
    maxCount?: number;
    contextLines: number;
    filenameOnly: boolean;
  }
): GrepMatch[] {
  const lines = content.split("\n");
  const matches: GrepMatch[] = [];
  let matchCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const hasMatch = regex.test(line);

    // Handle invert match option
    const shouldInclude = options.invertMatch ? !hasMatch : hasMatch;

    if (shouldInclude) {
      if (options.filenameOnly) {
        // Just return one match to indicate file contains matches
        return [{
          file: filepath,
          line: i + 1,
          column: 0,
          content: line,
          match: ""
        }];
      }

      if (hasMatch && !options.invertMatch) {
        // Find all matches in the line
        const lineMatches = Array.from(line.matchAll(new RegExp(regex.source, regex.flags + "g")));

        for (const match of lineMatches) {
          matches.push({
            file: filepath,
            line: i + 1,
            column: (match.index || 0) + 1,
            content: line,
            match: match[0]
          });

          matchCount++;

          if (options.maxCount && matchCount >= options.maxCount) {
            return matches;
          }
        }
      } else if (options.invertMatch) {
        // For inverted matches, show the whole line
        matches.push({
          file: filepath,
          line: i + 1,
          column: 0,
          content: line,
          match: ""
        });

        matchCount++;

        if (options.maxCount && matchCount >= options.maxCount) {
          return matches;
        }
      }
    }
  }

  // Add context lines if requested
  if (options.contextLines > 0 && matches.length > 0) {
    return addContextLines(matches, lines, options.contextLines);
  }

  return matches;
}

/**
 * Add context lines around matches
 */
function addContextLines(
  matches: GrepMatch[],
  allLines: string[],
  contextLines: number
): GrepMatch[] {
  const result: GrepMatch[] = [];
  const addedLines = new Set<string>();

  for (const match of matches) {
    const lineIndex = match.line - 1;

    // Add lines before the match
    for (let i = Math.max(0, lineIndex - contextLines); i < lineIndex; i++) {
      const key = `${match.file}:${i + 1}`;
      if (!addedLines.has(key)) {
        result.push({
          file: match.file,
          line: i + 1,
          column: 0,
          content: allLines[i],
          match: "" // Context line, no match
        });
        addedLines.add(key);
      }
    }

    // Add the actual match
    result.push(match);
    addedLines.add(`${match.file}:${match.line}`);

    // Add lines after the match
    for (let i = lineIndex + 1; i <= Math.min(allLines.length - 1, lineIndex + contextLines); i++) {
      const key = `${match.file}:${i + 1}`;
      if (!addedLines.has(key)) {
        result.push({
          file: match.file,
          line: i + 1,
          column: 0,
          content: allLines[i],
          match: "" // Context line, no match
        });
        addedLines.add(key);
      }
    }
  }

  return result;
}

/**
 * Create search regex from pattern
 */
function createSearchRegex(
  pattern: string | RegExp,
  options: { ignoreCase: boolean; wholeWord: boolean }
): RegExp {
  if (pattern instanceof RegExp) {
    return pattern;
  }

  let regexPattern = pattern;

  // Escape special regex characters if it's a plain string
  regexPattern = regexPattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // Add word boundary if wholeWord is true
  if (options.wholeWord) {
    regexPattern = `\\b${regexPattern}\\b`;
  }

  const flags = options.ignoreCase ? "i" : "";

  return new RegExp(regexPattern, flags);
}

/**
 * Get files to search from a git reference
 */
async function getFilesFromRef(
  fs: FileSystem,
  adaptedFs: any,
  gitdir: string,
  ref: string,
  paths?: string[],
  cache?: Map<string, any>
): Promise<Array<{ path: string; oid: string }>> {
  const oid = await resolveRef({
    fs: adaptedFs,
    gitdir,
    ref
  });

  const commit = await readCommit({
    fs: adaptedFs,
    gitdir,
    oid
  });

  const tree = await readTree({
    fs: adaptedFs,
    gitdir,
    oid: commit.commit.tree
  });

  const files: Array<{ path: string; oid: string }> = [];

  // Recursively collect all files from tree
  await collectTreeFiles(fs, adaptedFs, gitdir, tree.tree, "", files, cache);

  // Filter by paths if specified
  if (paths && paths.length > 0) {
    return files.filter(file =>
      paths.some(path => file.path === path || file.path.startsWith(path + "/"))
    );
  }

  return files;
}

/**
 * Recursively collect files from a tree
 */
async function collectTreeFiles(
  fs: FileSystem,
  adaptedFs: any,
  gitdir: string,
  treeEntries: Array<{ mode: string; path: string; oid: string; type: string }>,
  basePath: string,
  files: Array<{ path: string; oid: string }>,
  cache?: Map<string, any>
): Promise<void> {
  for (const entry of treeEntries) {
    const fullPath = basePath ? join(basePath, entry.path) : entry.path;

    if (entry.type === "blob") {
      // It's a file
      files.push({
        path: fullPath,
        oid: entry.oid
      });
    } else if (entry.type === "tree") {
      // It's a directory, recurse
      const subtree = await readTree({
        fs: adaptedFs,
        gitdir,
        oid: entry.oid
      });

      await collectTreeFiles(fs, adaptedFs, gitdir, subtree.tree, fullPath, files, cache);
    }
  }
}

/**
 * Get files to search from working directory
 */
async function getFilesFromWorkingDirectory(
  fs: FileSystem,
  dir: string,
  paths?: string[]
): Promise<Array<{ path: string }>> {
  const files: Array<{ path: string }> = [];

  if (paths && paths.length > 0) {
    // Search specific paths
    for (const path of paths) {
      const fullPath = join(dir, path);

      try {
        const stat = await fs.lstat(fullPath);

        if (stat && stat.isFile()) {
          files.push({ path });
        } else if (stat && stat.isDirectory()) {
          await collectDirectoryFiles(fs, dir, path, files);
        }
      } catch {
        // Path doesn't exist, skip
      }
    }
  } else {
    // Search all files in working directory
    await collectDirectoryFiles(fs, dir, "", files);
  }

  return files;
}

/**
 * Recursively collect files from a directory
 */
async function collectDirectoryFiles(
  fs: FileSystem,
  baseDir: string,
  relativePath: string,
  files: Array<{ path: string }>
): Promise<void> {
  const fullPath = relativePath ? join(baseDir, relativePath) : baseDir;

  try {
    const entries = await fs.readdir(fullPath);

    if (!entries) return;

    for (const entryName of entries) {
      // Skip .git directory
      if (entryName === ".git") {
        continue;
      }

      const entryRelativePath = relativePath ? join(relativePath, entryName) : entryName;
      const entryFullPath = join(fullPath, entryName);

      try {
        const stat = await fs.lstat(entryFullPath);
        if (stat && stat.isFile()) {
          files.push({ path: entryRelativePath });
        } else if (stat && stat.isDirectory()) {
          await collectDirectoryFiles(fs, baseDir, entryRelativePath, files);
        }
      } catch {
        // Entry might not be accessible, skip
      }
    }
  } catch {
    // Directory might not be accessible, skip
  }
}

/**
 * Format grep results for display
 */
export function formatGrepResults(
  results: GrepResult,
  options: { showLineNumbers?: boolean; showFilenames?: boolean } = {}
): string[] {
  const { showLineNumbers = true, showFilenames = true } = options;
  const lines: string[] = [];

  let currentFile = "";

  for (const match of results.matches) {
    if (showFilenames && match.file !== currentFile) {
      if (currentFile !== "") {
        lines.push(""); // Empty line between files
      }
      lines.push(`${match.file}:`);
      currentFile = match.file;
    }

    let line = "";

    if (showFilenames && !showLineNumbers) {
      line = `${match.file}:${match.content}`;
    } else if (showLineNumbers) {
      const prefix = showFilenames ? "" : `${match.file}:`;
      line = `${prefix}${match.line}:${match.content}`;
    } else {
      line = match.content;
    }

    lines.push(line);
  }

  return lines;
}

/**
 * Git diff models and types
 */

export interface DiffLine {
  content: string;
  type: "add" | "delete" | "context" | "header";
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface FileDiff {
  oldPath: string;
  newPath: string;
  oldMode?: string;
  newMode?: string;
  oldOid?: string;
  newOid?: string;
  status: "added" | "deleted" | "modified" | "renamed" | "copied";
  hunks: Hunk[];
  isBinary?: boolean;
}

export interface Hunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
  header: string;
}

export interface DiffResult {
  files: FileDiff[];
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

export interface DiffOptions {
  unified?: number;  // Context lines (default: 3)
  ignoreWhitespace?: boolean;
  ignoreWhitespaceAtEol?: boolean;
  ignoreBlankLines?: boolean;
  binary?: boolean;  // Include binary diffs
  nameOnly?: boolean;
  nameStatus?: boolean;
  raw?: boolean;
}
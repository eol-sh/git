/**
 * Git blame models and types
 */

export interface BlameLine {
  oid: string;
  originalLineNumber: number;
  finalLineNumber: number;
  content: string;
  author: string;
  authorEmail: string;
  authorTime: number;
  authorTimezone: string;
  committer: string;
  committerEmail: string;
  committerTime: number;
  committerTimezone: string;
  summary: string;
  filename?: string;
  previous?: string;
}

export interface BlameResult {
  lines: BlameLine[];
}

export interface BlameOptions {
  startLine?: number;
  endLine?: number;
  reverse?: boolean;
  firstParent?: boolean;
}

export interface BlameHunk {
  commitOid: string;
  lines: {
    original: number;
    final: number;
    content: string;
  }[];
  commit: {
    author: string;
    authorEmail: string;
    authorTime: number;
    authorTimezone: string;
    committer: string;
    committerEmail: string;
    committerTime: number;
    committerTimezone: string;
    summary: string;
    previous?: string;
    filename: string;
  };
}
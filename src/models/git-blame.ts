/**
 * @fileoverview git-blame model definition
 *
 * Defines the git-blame class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-blame.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
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
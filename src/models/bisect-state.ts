/**
 * @fileoverview bisect-state model definition
 *
 * Defines the bisect-state class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/bisect-state.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
 * Git bisect state models and types
 */

export interface BisectState {
  bad: string;
  good: string[];
  current?: string;
  start: string;
  names: { [oid: string]: string };
  log: BisectLogEntry[];
  terms?: {
    good: string;
    bad: string;
  };
  paths?: string[];
}

export interface BisectLogEntry {
  oid: string;
  result: BisectResult;
  timestamp: number;
}

export type BisectResult = "good" | "bad" | "skip";

export interface BisectCommand {
  command: "start" | "good" | "bad" | "skip" | "reset" | "run" | "log" | "replay";
  ref?: string;
  goodRefs?: string[];
  badRef?: string;
  script?: string;
}

export interface BisectOptions {
  good?: string[];
  bad?: string;
  start?: string;
  terms?: {
    good: string;
    bad: string;
  };
  noCheckout?: boolean;
  paths?: string[];
}

export interface BisectSearchResult {
  found: boolean;
  oid?: string;
  remaining: number;
  steps: number;
  message: string;
}

export interface BisectRunResult {
  success: boolean;
  oid?: string;
  result?: BisectResult;
  remaining?: number;
  message: string;
  finished?: boolean;
}

/**
 * Bisect state file paths
 */
export const BISECT_PATHS = {
  BISECT_START: "BISECT_START",
  BISECT_BAD: "BISECT_BAD", 
  BISECT_GOOD: "BISECT_GOOD",
  BISECT_LOG: "BISECT_LOG",
  BISECT_NAMES: "BISECT_NAMES",
  BISECT_TERMS: "BISECT_TERMS",
  BISECT_RUN: "BISECT_RUN",
  BISECT_PATHS: "BISECT_PATHS"
} as const;

/**
 * Default bisect terms
 */
export const DEFAULT_BISECT_TERMS = {
  good: "good",
  bad: "bad"
} as const;
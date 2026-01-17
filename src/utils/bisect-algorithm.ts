/**
 * Git bisect algorithm utilities
 *
 * Implementation of binary search algorithm for finding the first bad commit
 */

import { FileSystem } from "../models/file-system.ts";
import { BisectState, BisectLogEntry, BisectResult } from "../models/bisect-state.ts";
import { log } from "../api/log.ts";

import type { Cache } from "../types.ts";

interface BisectAlgorithmOptions {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
}

/**
 * Calculate the next commit to test during bisect
 */
export async function calculateBisectCommit(
  state: BisectState,
  options: BisectAlgorithmOptions
): Promise<string | null> {
  // const { fs, gitdir } = options;

  // Get all commits between good and bad commits
  const commits = await getCommitRange(state, options);

  if (commits.length === 0) {
    return null; // Bisect complete
  }

  // Filter out already tested commits
  const untested = commits.filter(commit =>
    !state.log.some(entry => entry.oid === commit)
  );

  if (untested.length === 0) {
    return null; // All commits tested
  }

  // Return the middle commit for binary search
  const midIndex = Math.floor(untested.length / 2);
  return untested[midIndex];
}

/**
 * Get all commits in the range between good and bad commits
 */
async function getCommitRange(
  state: BisectState,
  options: BisectAlgorithmOptions
): Promise<string[]> {
  const { fs, gitdir } = options;

  try {
    // Get commit history from bad to all good commits
    const commits = new Set<string>();

    // Start from bad commit and walk backwards
    const badCommits = await log({
      cache,
      dir,
      fs: fs.promises,
      gitdir,
      ref: state.bad,
      depth: 1000 // Reasonable limit
    });

    // For each good commit, find commits reachable from bad but not from good
    for (const goodRef of state.good) {
      const goodCommits = await log({
        cache,
        dir,
        fs: fs.promises,
        gitdir,
        ref: goodRef,
        depth: 1000
      });

      // Remove good commits from the set
      const goodOids = new Set(goodCommits.map(c => c.oid));

      for (const commit of badCommits) {
        if (!goodOids.has(commit.oid)) {
          commits.add(commit.oid);
        }
      }
    }

    return Array.from(commits).sort(); // Sort for consistent ordering
  } catch (error) {
    throw new Error(`Failed to calculate commit range: ${error}`);
  }
}

/**
 * Check if bisect is complete and return the culprit commit
 */
export function checkBisectComplete(state: BisectState): {
  complete: boolean;
  culprit?: string;
  remaining: number;
} {
  // Count untested commits
  // const testedCommits = new Set(state.log.map(entry => entry.oid));

  // If we've narrowed it down to one commit, we're done
  const remainingCount = getRemainingCommitCount(state);

  if (remainingCount <= 1) {
    // Find the first bad commit
    const badEntries = state.log
      .filter(entry => entry.result === "bad")
      .sort((a, b) => a.timestamp - b.timestamp);

    return {
      complete: true,
      culprit: badEntries.length > 0 ? badEntries[0].oid : state.bad,
      remaining: 0
    };
  }

  return {
    complete: false,
    remaining: remainingCount
  };
}

/**
 * Estimate remaining commits to test
 */
function getRemainingCommitCount(state: BisectState): number {
  const tested = state.log.length;
  // const badCommits = state.log.filter(entry => entry.result === "bad").length;
  const goodCommits = state.log.filter(entry => entry.result === "good").length;

  // Simple estimation: log2 of remaining commits
  // In practice this would require more sophisticated commit graph analysis
  return Math.max(0, Math.ceil(Math.log2(Math.max(1, tested - goodCommits))));
}

/**
 * Add a bisect result to the log
 */
export function addBisectResult(
  state: BisectState,
  oid: string,
  result: BisectResult
): BisectState {
  const entry: BisectLogEntry = {
    oid,
    result,
    timestamp: Date.now()
  };

  return {
    ...state,
    log: [...state.log, entry],
    current: oid
  };
}

/**
 * Validate bisect state consistency
 */
export function validateBisectState(state: BisectState): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Must have at least one bad commit
  if (!state.bad) {
    errors.push("No bad commit specified");
  }

  // Must have at least one good commit
  if (state.good.length === 0) {
    errors.push("No good commits specified");
  }

  // Bad commit should not be in good commits
  if (state.good.includes(state.bad)) {
    errors.push("Bad commit cannot also be marked as good");
  }

  // Validate log entries
  for (const entry of state.log) {
    if (!entry.oid || !entry.result || !entry.timestamp) {
      errors.push(`Invalid log entry: ${JSON.stringify(entry)}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get bisect terms (good/bad or custom terms)
 */
export function getBisectTerms(state: BisectState): { good: string; bad: string } {
  return state.terms || { good: "good", bad: "bad" };
}

/**
 * Create initial bisect state
 */
export function createInitialBisectState(
  bad: string,
  good: string[],
  start: string,
  terms?: { good: string; bad: string },
  paths?: string[]
): BisectState {
  return {
    bad,
    good,
    start,
    names: {},
    log: [],
    terms,
    paths: paths && paths.length > 0 ? paths : undefined
  };
}

/**
 * Calculate steps remaining in bisect
 */
export function calculateStepsRemaining(state: BisectState): number {
  const remaining = getRemainingCommitCount(state);
  return Math.ceil(Math.log2(remaining + 1));
}

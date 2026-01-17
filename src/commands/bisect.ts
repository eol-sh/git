/**
 * Git bisect command implementation
 */

import { FileSystem } from "../models/file-system.ts";
import { BisectState, BisectSearchResult, BisectRunResult, BISECT_PATHS, DEFAULT_BISECT_TERMS } from "../models/bisect-state.ts";
import { 
  calculateBisectCommit, 
  checkBisectComplete, 
  addBisectResult, 
  validateBisectState,
  createInitialBisectState,
  calculateStepsRemaining
} from "../utils/bisect-algorithm.ts";
import { resolveRef } from "../api/resolve-ref.ts";
import { checkout } from "../api/checkout.ts";
import { currentBranch } from "../api/current-branch.ts";
import { join } from "../utils/join.ts";

import type { Cache } from "../types.ts";

interface BisectCommandOptions {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
}

interface BisectStartCommandOptions extends BisectCommandOptions {
  options: {
    bad?: string;
    good?: string[];
    terms?: {
      good: string;
      bad: string;
    };
    noCheckout?: boolean;
  };
}

/**
 * Start bisect session
 */
export async function _bisectStart({
  cache,
  dir,
  fs,
  gitdir,
  options
}: BisectStartCommandOptions): Promise<BisectSearchResult> {
  const { bad = "HEAD", good = [], terms, noCheckout = false } = options;

  try {
    // Check if bisect is already in progress
    const bisectDir = join(gitdir, "refs", "bisect");
    const bisectExists = await fs.exists(bisectDir);
    
    if (bisectExists) {
      throw new Error("Bisect already in progress. Use 'git bisect reset' to reset first.");
    }

    // Resolve references
    const badOid = await resolveRef({ 
      fs: fs.promises, 
      gitdir, 
      ref: bad 
    });
    
    const goodOids: string[] = [];
    for (const goodRef of good) {
      const oid = await resolveRef({ 
        fs: fs.promises, 
        gitdir, 
        ref: goodRef 
      });
      goodOids.push(oid);
    }

    // Create initial bisect state
    const currentRef = await currentBranch({ fs: fs.promises, dir, gitdir }) || "HEAD";
    const startOid = await resolveRef({ 
      fs: fs.promises, 
      gitdir, 
      ref: currentRef 
    });

    const state = createInitialBisectState(badOid, goodOids, startOid, terms);
    
    // Validate state
    const validation = validateBisectState(state);
    if (!validation.valid) {
      throw new Error(`Invalid bisect state: ${validation.errors.join(", ")}`);
    }

    // Save bisect state files
    await saveBisectState(fs, gitdir, state);

    // Calculate first commit to test
    const nextCommit = await calculateBisectCommit(state, {
      cache,
      dir,
      fs,
      gitdir
    });

    if (!nextCommit) {
      return {
        found: true,
        remaining: 0,
        steps: 0,
        message: "No commits to bisect"
      };
    }

    // Checkout the commit to test (unless noCheckout)
    if (!noCheckout) {
      await checkout({
        fs: fs.promises,
        dir,
        gitdir,
        ref: nextCommit
      });
    }

    const remaining = calculateStepsRemaining(state);
    
    return {
      found: false,
      oid: nextCommit,
      remaining,
      steps: remaining,
      message: `Bisecting: ${remaining} revisions left to test after this (roughly ${remaining} steps)`
    };

  } catch (error) {
    throw new Error(`Failed to start bisect: ${error}`);
  }
}

/**
 * Mark current commit as good
 */
export async function _bisectGood({
  cache,
  dir,
  fs,
  gitdir,
  ref
}: BisectCommandOptions & { ref?: string }): Promise<BisectSearchResult> {
  return await markCommit({
    cache,
    dir,
    fs,
    gitdir,
    ref,
    result: "good"
  });
}

/**
 * Mark current commit as bad
 */
export async function _bisectBad({
  cache,
  dir,
  fs,
  gitdir,
  ref
}: BisectCommandOptions & { ref?: string }): Promise<BisectSearchResult> {
  return await markCommit({
    cache,
    dir,
    fs,
    gitdir,
    ref,
    result: "bad"
  });
}

/**
 * Skip current commit
 */
export async function _bisectSkip({
  cache,
  dir,
  fs,
  gitdir,
  ref
}: BisectCommandOptions & { ref?: string }): Promise<BisectSearchResult> {
  return await markCommit({
    cache,
    dir,
    fs,
    gitdir,
    ref,
    result: "skip"
  });
}

/**
 * Common function to mark a commit with a result
 */
async function markCommit({
  cache,
  dir,
  fs,
  gitdir,
  ref,
  result
}: BisectCommandOptions & { 
  ref?: string; 
  result: "good" | "bad" | "skip" 
}): Promise<BisectSearchResult> {
  try {
    // Load current bisect state
    const state = await loadBisectState(fs, gitdir);
    
    // Determine which commit to mark
    const oid = ref ? await resolveRef({ 
      fs: fs.promises, 
      gitdir, 
      ref 
    }) : state.current || "HEAD";
    
    const resolvedOid = typeof oid === "string" ? oid : await resolveRef({ 
      fs: fs.promises, 
      gitdir, 
      ref: "HEAD" 
    });

    // Add result to state
    const newState = addBisectResult(state, resolvedOid, result);

    // Check if bisect is complete
    const completion = checkBisectComplete(newState);
    
    if (completion.complete) {
      // Clean up bisect state
      await cleanupBisectState(fs, gitdir);
      
      return {
        found: true,
        oid: completion.culprit,
        remaining: 0,
        steps: 0,
        message: completion.culprit ? 
          `${completion.culprit} is the first bad commit` : 
          "Bisect complete"
      };
    }

    // Save updated state
    await saveBisectState(fs, gitdir, newState);

    // Calculate next commit to test
    const nextCommit = await calculateBisectCommit(newState, {
      cache,
      dir,
      fs,
      gitdir
    });

    if (!nextCommit) {
      await cleanupBisectState(fs, gitdir);
      return {
        found: true,
        remaining: 0,
        steps: 0,
        message: "No more commits to test"
      };
    }

    // Checkout next commit
    await checkout({
      fs: fs.promises,
      dir,
      gitdir,
      ref: nextCommit
    });

    const remaining = completion.remaining;
    const steps = calculateStepsRemaining(newState);
    
    return {
      found: false,
      oid: nextCommit,
      remaining,
      steps,
      message: `Bisecting: ${remaining} revisions left to test after this (roughly ${steps} steps)`
    };

  } catch (error) {
    throw new Error(`Failed to mark commit as ${result}: ${error}`);
  }
}

/**
 * Reset bisect session
 */
export async function _bisectReset({
  cache,
  dir,
  fs,
  gitdir
}: BisectCommandOptions): Promise<void> {
  try {
    // Load bisect state to get original HEAD
    const state = await loadBisectState(fs, gitdir);
    
    // Checkout original HEAD
    await checkout({
      fs: fs.promises,
      dir,
      gitdir,
      ref: state.start
    });

    // Clean up bisect state
    await cleanupBisectState(fs, gitdir);

  } catch (error) {
    // If state doesn't exist, just clean up any partial state
    await cleanupBisectState(fs, gitdir);
  }
}

/**
 * Get bisect log
 */
export async function _bisectLog({
  cache,
  dir,
  fs,
  gitdir
}: BisectCommandOptions): Promise<string[]> {
  try {
    const state = await loadBisectState(fs, gitdir);
    
    const logLines: string[] = [];
    logLines.push(`# bad: [${state.bad}]`);
    
    for (const goodOid of state.good) {
      logLines.push(`# good: [${goodOid}]`);
    }
    
    for (const entry of state.log) {
      const date = new Date(entry.timestamp).toISOString();
      logLines.push(`git bisect ${entry.result} ${entry.oid} # ${date}`);
    }
    
    return logLines;

  } catch (error) {
    throw new Error(`Failed to get bisect log: ${error}`);
  }
}

/**
 * Replay bisect from log file
 */
export async function _bisectReplay({
  cache,
  dir,
  fs,
  gitdir,
  filename
}: BisectCommandOptions & { filename: string }): Promise<BisectSearchResult> {
  try {
    // Read replay file
    const content = await fs.readFile(join(dir, filename), { encoding: "utf8" });
    const lines = content.split("\n").filter(line => line.trim() && !line.startsWith("#"));

    // Reset any existing bisect
    try {
      await _bisectReset({ cache, dir, fs, gitdir });
    } catch {
      // Ignore if no bisect in progress
    }

    let result: BisectSearchResult = {
      found: false,
      remaining: 0,
      steps: 0,
      message: "Replay started"
    };

    // Execute commands from file
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3 || parts[0] !== "git" || parts[1] !== "bisect") {
        continue;
      }

      const command = parts[2];
      const oid = parts[3];

      switch (command) {
        case "start":
          // Parse start command (simplified)
          result = await _bisectStart({
            cache,
            dir,
            fs,
            gitdir,
            options: { bad: "HEAD", good: [] }
          });
          break;
          
        case "good":
          result = await _bisectGood({ cache, dir, fs, gitdir, ref: oid });
          break;
          
        case "bad":
          result = await _bisectBad({ cache, dir, fs, gitdir, ref: oid });
          break;
          
        case "skip":
          result = await _bisectSkip({ cache, dir, fs, gitdir, ref: oid });
          break;
      }

      if (result.found) {
        break;
      }
    }

    return result;

  } catch (error) {
    throw new Error(`Failed to replay bisect: ${error}`);
  }
}

/**
 * Save bisect state to files
 */
async function saveBisectState(fs: FileSystem, gitdir: string, state: BisectState): Promise<void> {
  const bisectDir = join(gitdir, "refs", "bisect");
  await fs.mkdir(bisectDir, { recursive: true });

  // Save individual state files
  await fs.writeFile(join(bisectDir, BISECT_PATHS.BISECT_START), state.start);
  await fs.writeFile(join(bisectDir, BISECT_PATHS.BISECT_BAD), state.bad);
  
  if (state.good.length > 0) {
    await fs.writeFile(join(bisectDir, BISECT_PATHS.BISECT_GOOD), state.good.join("\n"));
  }

  if (state.terms) {
    const termsContent = `${state.terms.good}\n${state.terms.bad}`;
    await fs.writeFile(join(bisectDir, BISECT_PATHS.BISECT_TERMS), termsContent);
  }

  // Save log
  const logContent = state.log.map(entry => 
    `${entry.oid} ${entry.result} ${entry.timestamp}`
  ).join("\n");
  await fs.writeFile(join(bisectDir, BISECT_PATHS.BISECT_LOG), logContent);

  // Save names mapping
  const namesContent = JSON.stringify(state.names);
  await fs.writeFile(join(bisectDir, BISECT_PATHS.BISECT_NAMES), namesContent);
}

/**
 * Load bisect state from files
 */
async function loadBisectState(fs: FileSystem, gitdir: string): Promise<BisectState> {
  const bisectDir = join(gitdir, "refs", "bisect");
  
  try {
    const start = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_START), { encoding: "utf8" });
    const bad = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_BAD), { encoding: "utf8" });
    
    let good: string[] = [];
    try {
      const goodContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_GOOD), { encoding: "utf8" });
      good = goodContent.trim().split("\n").filter(line => line.trim());
    } catch {
      // Good file might not exist
    }

    let terms = undefined;
    try {
      const termsContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_TERMS), { encoding: "utf8" });
      const termLines = termsContent.trim().split("\n");
      if (termLines.length >= 2) {
        terms = { good: termLines[0], bad: termLines[1] };
      }
    } catch {
      // Terms file might not exist
    }

    let log = [];
    try {
      const logContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_LOG), { encoding: "utf8" });
      log = logContent.trim().split("\n").filter(line => line.trim()).map(line => {
        const parts = line.split(" ");
        return {
          oid: parts[0],
          result: parts[1] as "good" | "bad" | "skip",
          timestamp: parseInt(parts[2] || "0")
        };
      });
    } catch {
      // Log file might not exist
    }

    let names = {};
    try {
      const namesContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_NAMES), { encoding: "utf8" });
      names = JSON.parse(namesContent);
    } catch {
      // Names file might not exist
    }

    return {
      start: start.trim(),
      bad: bad.trim(),
      good,
      log,
      names,
      terms,
      current: log.length > 0 ? log[log.length - 1].oid : undefined
    };

  } catch (error) {
    throw new Error(`No bisect session in progress`);
  }
}

/**
 * Clean up bisect state files
 */
async function cleanupBisectState(fs: FileSystem, gitdir: string): Promise<void> {
  const bisectDir = join(gitdir, "refs", "bisect");
  
  try {
    await fs.rm(bisectDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist
  }
}
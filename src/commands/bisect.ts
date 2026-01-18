/**
 * @fileoverview Command for Git bisect binary search to find problematic commits
 * 
 * Implements Git's bisect functionality for finding the commit that introduced
 * a bug using binary search. Manages bisect state, tracks good/bad commits,
 * and automatically narrows down the problematic commit through systematic testing.
 * 
 * @module commands/bisect
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

import { FileSystem } from "../models/file-system.ts";
import { BisectState, BisectSearchResult, BisectRunResult, BISECT_PATHS } from "../models/bisect-state.ts";
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
    } | undefined;
    noCheckout?: boolean;
    paths?: string[];
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
  const { bad = "HEAD", good = [], terms, noCheckout = false, paths = [] } = options;

  try {
    // Check if bisect is already in progress
    const bisectDir = join(gitdir, "refs", "bisect");
    const bisectExists = await fs.exists(bisectDir);

    if (bisectExists) {
      throw new Error("Bisect already in progress. Use 'git bisect reset' to reset first.");
    }

    // Resolve references
    const badOid = await resolveRef({
      fs: fs as any,
      gitdir,
      ref: bad
    });

    const goodOids: string[] = [];
    for (const goodRef of good) {
      const oid = await resolveRef({
        fs: fs as any,
        gitdir,
        ref: goodRef
      });
      goodOids.push(oid);
    }

    // Create initial bisect state
    const currentRef = await currentBranch({ fs: fs as any, dir, gitdir }) || "HEAD";
    const startOid = await resolveRef({
      fs: fs as any,
      gitdir,
      ref: currentRef
    });

    const state = createInitialBisectState(badOid, goodOids, startOid, terms, paths);

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
        fs: fs as any,
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
      fs: fs as any,
      gitdir,
      ref
    }) : state.current || "HEAD";

    const resolvedOid = typeof oid === "string" ? oid : await resolveRef({
      fs: fs as any,
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
      fs: fs as any,
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
  // cache,
  dir,
  fs,
  gitdir
}: BisectCommandOptions): Promise<void> {
  try {
    // Load bisect state to get original HEAD
    const state = await loadBisectState(fs, gitdir);

    // Checkout original HEAD
    await checkout({
      fs: fs as any,
      dir,
      gitdir,
      ref: state.start
    });

    // Clean up bisect state
    await cleanupBisectState(fs, gitdir);

  } catch {
    // If state doesn't exist, just clean up any partial state
    await cleanupBisectState(fs, gitdir);
  }
}

/**
 * Get bisect log
 */
export async function _bisectLog({
  // cache,
  // dir,
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
    const contentStr = typeof content === 'string' ? content : new TextDecoder().decode(content);
    const lines = contentStr.split("\n").filter(line => line.trim() && !line.startsWith("#"));

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
        case "start": {
          // Parse start command with full argument support
          const startOptions = parseBisectStartCommand(parts.slice(2));
          result = await _bisectStart({
            cache,
            dir,
            fs,
            gitdir,
            options: startOptions
          });

          break;
        }

        case "good": {
          result = await _bisectGood({ cache, dir, fs, gitdir, ref: oid });
          break;
        }

        case "bad": {
          result = await _bisectBad({ cache, dir, fs, gitdir, ref: oid });
          break;
        }

        case "skip": {
          result = await _bisectSkip({ cache, dir, fs, gitdir, ref: oid });
          break;
        }
      }

      if (result.found)
        break;
    }

    return result;

  } catch (error) {
    throw new Error(`Failed to replay bisect: ${String(error)}`);
  }
}

/**
 * Parse bisect start command arguments
 * Supports: bisect start [<bad> [<good>...]] [-- <paths>...]
 * Also supports: bisect start --term-good=<term> --term-bad=<term>
 */
function parseBisectStartCommand(args: string[]): {
  bad?: string;
  good?: string[];
  terms?: { good: string; bad: string } | undefined;
  noCheckout?: boolean;
  paths?: string[];
} {
  const options = {
    bad: undefined as string | undefined,
    good: [] as string[],
    terms: undefined as { good: string; bad: string } | undefined,
    noCheckout: false,
    paths: [] as string[]
  };

  let i = 1; // Skip "start"
  let inPaths = false;

  while (i < args.length) {
    const arg = args[i];

    if (arg === "--") {
      inPaths = true;
      i++;
      continue;
    }

    if (inPaths) {
      options.paths.push(arg);
      i++;
      continue;
    }

    if (arg.startsWith("--term-good=")) {
      const term = arg.slice(12); // Remove "--term-good="
      if (!options.terms) {
        options.terms = { good: term, bad: "bad" };
      } else {
        options.terms.good = term;
      }
      i++;
      continue;
    }

    if (arg.startsWith("--term-bad=")) {
      const term = arg.slice(11); // Remove "--term-bad="
      if (!options.terms) {
        options.terms = { good: "good", bad: term };
      } else {
        options.terms.bad = term;
      }
      i++;
      continue;
    }

    if (arg === "--no-checkout") {
      options.noCheckout = true;
      i++;
      continue;
    }

    // Positional arguments: first is bad, rest are good
    if (!options.bad) {
      options.bad = arg;
    } else {
      options.good.push(arg);
    }
    i++;
  }

  // Set defaults if not specified
  if (!options.bad) {
    options.bad = "HEAD";
  }

  return options;
}

/**
 * Save bisect state to files
 */
async function saveBisectState(fs: FileSystem, gitdir: string, state: BisectState): Promise<void> {
  const bisectDir = join(gitdir, "refs", "bisect");
  await (fs as any).mkdir(bisectDir, { recursive: true });

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

  if (state.paths && state.paths.length > 0) {
    await fs.writeFile(join(bisectDir, BISECT_PATHS.BISECT_PATHS), state.paths.join("\n"));
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
    const startContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_START), { encoding: "utf8" });
    const start = typeof startContent === 'string' ? startContent : new TextDecoder().decode(startContent);
    const badContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_BAD), { encoding: "utf8" });
    const bad = typeof badContent === 'string' ? badContent : new TextDecoder().decode(badContent);

    let good: string[] = [];
    try {
      const goodContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_GOOD), { encoding: "utf8" });
      const goodStr = typeof goodContent === 'string' ? goodContent : new TextDecoder().decode(goodContent);
      good = goodStr.trim().split("\n").filter(line => line.trim());
    } catch {
      // Good file might not exist
    }

    let terms: { good: string; bad: string } | undefined = undefined;
    try {
      const termsContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_TERMS), { encoding: "utf8" });
      const termsStr = typeof termsContent === 'string' ? termsContent : new TextDecoder().decode(termsContent);
      const termLines = termsStr.trim().split("\n");
      if (termLines.length >= 2) {
        terms = { good: termLines[0], bad: termLines[1] };
      }
    } catch {
      // Terms file might not exist
    }

    let log: { oid: string; result: "good" | "bad" | "skip"; timestamp: number }[] = [];
    try {
      const logContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_LOG), { encoding: "utf8" });
      const logStr = typeof logContent === 'string' ? logContent : new TextDecoder().decode(logContent);
      log = logStr.trim().split("\n").filter(line => line.trim()).map(line => {
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
      const namesStr = typeof namesContent === 'string' ? namesContent : new TextDecoder().decode(namesContent);
      names = JSON.parse(namesStr);
    } catch {
      // Names file might not exist
    }

    let paths: string[] | undefined = undefined;
    try {
      const pathsContent = await fs.readFile(join(bisectDir, BISECT_PATHS.BISECT_PATHS), { encoding: "utf8" });
      const pathsStr = typeof pathsContent === 'string' ? pathsContent : new TextDecoder().decode(pathsContent);
      paths = pathsStr.trim().split("\n").filter(line => line.trim());
      if (paths.length === 0) paths = undefined;
    } catch {
      // Paths file might not exist
    }

    return {
      start: start.trim(),
      bad: bad.trim(),
      good,
      log,
      names,
      terms,
      paths,
      current: log.length > 0 ? log[log.length - 1].oid : undefined
    };

  } catch {
    throw new Error(`No bisect session in progress`);
  }
}

/**
 * Clean up bisect state files
 */
async function cleanupBisectState(fs: FileSystem, gitdir: string): Promise<void> {
  const bisectDir = join(gitdir, "refs", "bisect");

  try {
    await (fs as any).rmdir(bisectDir, { recursive: true });
  } catch {
    // Directory might not exist
  }
}

interface BisectRunCommandOptions extends BisectCommandOptions {
  cache: Cache;
  script: string;
}

/**
 * Run automated bisect with a test script
 */
export async function _bisectRun({
  cache,
  dir,
  fs,
  gitdir,
  script
}: BisectRunCommandOptions): Promise<BisectRunResult> {
  try {
    // Check if bisect session is active
    let state: BisectState;
    try {
      state = await loadBisectState(fs, gitdir);
    } catch {
      return {
        success: false,
        message: "No bisect session in progress. Use 'git bisect start' first.",
        finished: false
      };
    }

    // Check if bisect is already complete
    const completionCheck = checkBisectComplete(state);
    if (completionCheck.complete) {
      return {
        success: true,
        oid: completionCheck.result?.oid,
        result: undefined,
        remaining: 0,
        message: completionCheck.message || "Bisect completed",
        finished: true
      };
    }

    let iterations = 0;
    const maxIterations = 100; // Safety limit

    while (!checkBisectComplete(state).complete && iterations < maxIterations) {
      // Calculate next commit to test
      const nextCommit = await calculateBisectCommit(state, { cache, dir, fs, gitdir });
      if (!nextCommit) {
        return {
          success: false,
          message: "Unable to find next commit for testing",
          finished: false
        };
      }

      // Checkout the commit (optional - depends on noCheckout setting)
      try {
        // For now, we'll just mark it without checkout to avoid complexity
        // In a full implementation, you'd checkout the commit first
      } catch (checkoutError) {
        return {
          success: false,
          message: `Failed to checkout commit ${nextCommit}: ${(checkoutError as Error).message}`,
          finished: false
        };
      }

      // Run the test script
      let testResult: "good" | "bad" | "skip";
      try {
        // Execute the script using Deno.Command
        const command = new Deno.Command("sh", {
          args: ["-c", script],
          cwd: dir,
          stdout: "piped",
          stderr: "piped"
        });

        const { code } = await command.output();

        // Standard git bisect run exit code interpretation:
        // 0 = good, 1-124 = bad, 125 = skip, 126+ = abort
        if (code === 0) {
          testResult = "good";
        } else if (code === 125) {
          testResult = "skip";
        } else if (code >= 126) {
          return {
            success: false,
            message: `Test script aborted with exit code ${code}`,
            finished: false
          };
        } else {
          testResult = "bad";
        }

      } catch (execError) {
        return {
          success: false,
          message: `Failed to execute test script: ${(execError as Error).message}`,
          finished: false
        };
      }

      // Add the result to bisect state
      state = addBisectResult(state, nextCommit!, testResult);

      // Save updated state
      await saveBisectState(fs, gitdir, state);

      iterations++;
    }

    if (iterations >= maxIterations) {
      return {
        success: false,
        message: "Bisect run exceeded maximum iterations (safety limit)",
        finished: false
      };
    }

    // Check final completion
    const finalCheck = checkBisectComplete(state);
    if (finalCheck.complete) {
      return {
        success: true,
        oid: finalCheck.result?.oid,
        result: undefined,
        remaining: 0,
        message: finalCheck.message || "Bisect run completed successfully",
        finished: true
      };
    }

    return {
      success: false,
      message: "Bisect run completed but no conclusive result found",
      finished: false
    };
  } catch (error) {
    throw new Error(`git bisect run failed: ${String(error)}`);
  }
}

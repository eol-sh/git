/**
 * @fileoverview Command for Git rebase operations to reapply commits
 * 
 * Implements Git's rebase functionality for rewriting commit history by
 * reapplying commits from one branch onto another. Supports interactive
 * rebase, conflict resolution, and maintaining commit relationships.
 * 
 * @module commands/rebase
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

import { _cherryPick } from "../commands/cherry-pick.ts";
import { _checkout } from "../commands/checkout.ts";
import { _readObject } from "../storage/read-object.ts";
import { _resolveRef } from "../commands/resolve-ref.ts";
import { _writeObject } from "../storage/write-object.ts";
import { _writeCommit } from "../commands/write-commit.ts";
import { _writeRef } from "../commands/write-ref.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";
// import { ObjectTypeError } from "../errors/object-type.ts";
import {
  RebaseState,
  RebaseOptions,
  RebaseResult,
  RebaseTodoItem,
  // RebaseAction,
  REBASE_PATHS
} from "../models/rebase-state.ts";
import {
  parseRebaseTodo,
  formatRebaseTodo,
  createDefaultTodoList,
  validateTodoList,
  applyAutosquash
} from "../utils/rebase-todo.ts";

import type { Cache } from "../types.ts";

interface RebaseCommandOptions {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  options: RebaseOptions;
}

/**
 * Internal rebase command - reapply commits on new base
 */
export async function _rebase({
  cache,
  dir,
  fs,
  gitdir,
  options
}: RebaseCommandOptions): Promise<RebaseResult> {
  const {
    onto,
    upstream,
    branch,
    interactive = false,
    autosquash = false,
    onEdit
  } = options;

  // Check if rebase is already in progress
  const rebaseDir = join(gitdir, REBASE_PATHS.DIR);
  const rebaseInProgress = await fs.exists?.(rebaseDir) ?? false;

  if (rebaseInProgress) {
    throw new Error("Rebase already in progress. Use --continue, --abort, or --skip");
  }

  // Resolve refs
  const ontoOid = onto ? await resolveCommit(fs, gitdir, cache, onto) : null;
  const upstreamOid = upstream ? await resolveCommit(fs, gitdir, cache, upstream) : null;
  const branchOid = branch ? await resolveCommit(fs, gitdir, cache, branch) :
    await _resolveRef({ cache, fs, gitdir, ref: "HEAD" });

  if (!branchOid) {
    throw new NotFoundError("Current HEAD");
  }

  // Determine the onto commit
  let targetOnto = ontoOid;
  if (!targetOnto && upstreamOid) {
    targetOnto = upstreamOid;
  }
  if (!targetOnto) {
    throw new Error("Must specify either --onto or --upstream");
  }

  // Get commit range to rebase
  const commitsToRebase = await getCommitRange({
    fs,
    gitdir,
    cache,
    from: upstreamOid || targetOnto,
    to: branchOid
  });

  if (commitsToRebase.length === 0) {
    return {
      success: true,
      message: "Current branch is up to date"
    };
  }

  // Create todo list
  let todoItems = createDefaultTodoList(commitsToRebase);

  // Apply autosquash if enabled
  if (autosquash) {
    todoItems = applyAutosquash(todoItems);
  }

  // Interactive mode - allow user to edit todo list
  if (interactive && onEdit) {
    const todoText = formatRebaseTodo(todoItems);
    const editedText = await onEdit(todoText);
    todoItems = parseRebaseTodo(editedText);

    // Validate edited todo list
    const validation = validateTodoList(todoItems);
    if (!validation.valid) {
      throw new Error(`Invalid todo list: ${validation.errors.join(", ")}`);
    }
  }

  // Initialize rebase state
  const state: RebaseState = {
    onto: targetOnto,
    orig_head: branchOid,
    head_name: await getCurrentBranchName(fs, gitdir),
    todo: todoItems,
    current: 0,
    interactive,
    abort_safety: branchOid
  };

  // Save rebase state
  await saveRebaseState(fs, gitdir, state);

  try {
    // Checkout onto commit
    await checkoutCommit({ cache, dir, fs, gitdir, oid: targetOnto });

    // Execute rebase
    const result = await executeRebase({
      cache,
      dir,
      fs,
      gitdir,
      state
    });

    // Clean up if successful
    if (result.success) {
      await cleanupRebaseState(fs, gitdir);
    }

    return result;
  } catch (error) {
    // Save state on error for potential continue/abort
    await saveRebaseState(fs, gitdir, state);
    throw error;
  }
}

/**
 * Continue rebase after resolving conflicts
 */
export async function _rebaseContinue({
  cache,
  dir,
  fs,
  gitdir
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
}): Promise<RebaseResult> {
  const state = await loadRebaseState(fs, gitdir);

  if (!state) {
    throw new Error("No rebase in progress");
  }

  // Continue from current position
  return await executeRebase({
    cache,
    dir,
    fs,
    gitdir,
    state
  });
}

/**
 * Abort rebase and return to original state
 */
export async function _rebaseAbort({
  cache,
  dir,
  fs,
  gitdir
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
}): Promise<RebaseResult> {
  const state = await loadRebaseState(fs, gitdir);

  if (!state) {
    throw new Error("No rebase in progress");
  }

  // Checkout original HEAD
  await checkoutCommit({ cache, dir, fs, gitdir, oid: state.orig_head });

  // Clean up rebase state
  await cleanupRebaseState(fs, gitdir);

  return {
    success: true,
    aborted: true,
    message: "Rebase aborted"
  };
}

/**
 * Skip current commit and continue rebase
 */
export async function _rebaseSkip({
  cache,
  dir,
  fs,
  gitdir
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
}): Promise<RebaseResult> {
  const state = await loadRebaseState(fs, gitdir);

  if (!state) {
    throw new Error("No rebase in progress");
  }

  // Skip current todo item
  state.current++;

  // Save updated state
  await saveRebaseState(fs, gitdir, state);

  // Continue rebase
  return await executeRebase({
    cache,
    dir,
    fs,
    gitdir,
    state
  });
}

/**
 * Execute the rebase process
 */
async function executeRebase({
  cache,
  dir,
  fs,
  gitdir,
  state
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  state: RebaseState;
}): Promise<RebaseResult> {
  while (state.current < state.todo.length) {
    const currentTodo = state.todo[state.current];

    try {
      const result = await executeTodoItem({
        cache,
        dir,
        fs,
        gitdir,
        item: currentTodo
      });

      if (result.conflicts && result.conflicts.length > 0) {
        // Stop for conflict resolution
        await saveRebaseState(fs, gitdir, state);
        return {
          success: false,
          conflicts: result.conflicts,
          message: `Conflicts in: ${result.conflicts.join(", ")}. Resolve and run 'git rebase --continue'`
        };
      }

      // Check if rebase was paused (break command)
      if ((result as any).paused) {
        return {
          success: true,
          paused: true,
          message: (result as any).message || "Rebase paused."
        };
      }

      // Check if command failed (exec command)
      if ((result as any).success === false) {
        await saveRebaseState(fs, gitdir, state);
        return {
          success: false,
          message: (result as any).message || "Command failed during rebase."
        };
      }

      // Move to next todo item
      state.current++;
      currentTodo.done = true;

    } catch (error) {
      // Save state and return error
      await saveRebaseState(fs, gitdir, state);
      throw error;
    }
  }

  // Rebase completed successfully
  // Update branch ref
  const newHead = await _resolveRef({ cache, fs, gitdir, ref: "HEAD" });
  if (newHead && state.head_name) {
    await GitRefManager.writeRef({
      fs: fs as any,
      gitdir,
      ref: state.head_name,
      value: newHead
    });
  }

  return {
    success: true,
    oid: newHead ?? undefined,
    message: "Rebase completed successfully"
  };
}

/**
 * Execute a single todo item
 */
async function executeTodoItem({
  cache,
  dir,
  fs,
  gitdir,
  item
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  item: RebaseTodoItem;
}): Promise<{ conflicts?: string[]; message?: string; paused?: boolean; success?: boolean }> {
  switch (item.command) {
    case "pick": {
      return await executePick(cache, dir, fs, gitdir, item);
    }

    case "reword": {
      return await executeReword(cache, dir, fs, gitdir, item);
    }

    case "edit": {
      return await executeEdit(cache, dir, fs, gitdir, item);
    }

    case "squash": {
      return await executeSquash(cache, dir, fs, gitdir, item);
    }

    case "fixup": {
      return await executeFixup(cache, dir, fs, gitdir, item);
    }

    case "exec": {
      return await executeExec(cache, dir, fs, gitdir, item);
    }

    case "break": {
      // Break command just pauses the rebase
      return {
        conflicts: [],
        message: "Rebase paused at break command. Use 'git rebase --continue' to resume.",
        paused: true,
        success: true
      };
    }

    case "drop": {
      return {}; // Do nothing for drop
    }

    default: {
      throw new Error(`Unsupported rebase command: ${item.command}`);
    }
  }
}

/**
 * Execute pick command
 */
async function executePick(
  cache: Cache,
  dir: string,
  fs: FileSystem,
  gitdir: string,
  item: RebaseTodoItem
): Promise<{ conflicts?: string[] }> {
  try {
    await _cherryPick({
      cache,
      dir,
      fs,
      gitdir,
      noCommit: false,
      oid: item.commit
    });

    return {};
  } catch {
    // Check for conflicts
    return {
      conflicts: [item.commit]
    };
  }
}

/**
 * Execute other commands (simplified implementations)
 */
async function executeReword(cache: Cache, dir: string, fs: FileSystem, gitdir: string, item: RebaseTodoItem) {
  // Reword: Apply commit but allow message editing
  try {
    // Apply the commit changes (cherry-pick with no-commit)
    await _cherryPick({
      cache,
      dir,
      fs,
      gitdir,
      noCommit: true,
      oid: item.commit
    });

    // Get the original commit info
    const { object } = await _readObject({
      cache,
      fs: fs as any,
      gitdir,
      oid: item.commit
    });

    const commit = GitCommit.from(object);
    const parsed = commit.parse();
    // Use rewritten message from todo item if provided, otherwise original message
    const message = item.message || parsed.message;

    // Create new commit with potentially edited message
    const newCommit = await _writeCommit({
      commit: {
        author: parsed.author,
        committer: {
          ...parsed.committer,
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: new Date().getTimezoneOffset()
        },
        message: String(message),
        parent: [String(await _resolveRef({ cache, fs, gitdir, ref: "HEAD" }))],
        tree: parsed.tree
      },
      fs: fs as any,
      gitdir
    });

    // Update HEAD to new commit
    await _writeRef({
      fs,
      gitdir,
      ref: "HEAD",
      value: newCommit
    });

    return {};
  } catch {
    return {
      conflicts: [item.commit]
    };
  }
}

async function executeEdit(cache: Cache, dir: string, fs: FileSystem, gitdir: string, item: RebaseTodoItem) {
  // Edit: Apply commit but pause for manual editing
  try {
    // Apply the commit changes (cherry-pick with no-commit)
    await _cherryPick({
      cache,
      dir,
      fs,
      gitdir,
      noCommit: true,
      oid: item.commit
    });

    // For edit operations, we stop here and let the user manually make changes
    // In a real interactive rebase, this would pause the process and wait for user to continue
    // For this implementation, we'll just apply the commit as-is
    // but in practice, the user would run `git rebase --continue` after making edits

    // Get the original commit info
    const { object } = await _readObject({
      cache,
      fs: fs as any,
      gitdir,
      oid: item.commit
    });

    const commit = GitCommit.from(object);
    const parsed = commit.parse();

    // Create new commit (user would normally amend this)
    const newCommit = await _writeCommit({
      commit: {
        author: parsed.author,
        committer: {
          ...parsed.committer,
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: new Date().getTimezoneOffset()
        },
        message: String(parsed.message),
        parent: [String(await _resolveRef({ cache, fs, gitdir, ref: "HEAD" }))],
        tree: parsed.tree
      },
      fs: fs as any,
      gitdir
    });

    // Update HEAD to new commit
    await _writeRef({
      fs,
      gitdir,
      ref: "HEAD",
      value: newCommit
    });

    return {};
  } catch {
    return {
      conflicts: [item.commit]
    };
  }
}

async function executeSquash(cache: Cache, dir: string, fs: FileSystem, gitdir: string, item: RebaseTodoItem) {
  // Squash: Combine this commit with the previous one, keeping both commit messages
  try {
    // Apply the commit changes (cherry-pick with no-commit)
    await _cherryPick({
      cache,
      dir,
      fs,
      gitdir,
      noCommit: true,
      oid: item.commit
    });

    // Get the current HEAD commit (previous commit)
    const headOid = await _resolveRef({ cache, fs, gitdir, ref: "HEAD" });

    const { object: headObject } = await _readObject({
      cache,
      fs: fs as any,
      gitdir,
      oid: String(headOid)
    });

    const headCommit = GitCommit.from(headObject);
    const headParsed = headCommit.parse();

    // Get the squash commit info
    const { object: squashObject } = await _readObject({
      cache,
      fs: fs as any,
      gitdir,
      oid: item.commit
    });

    const squashCommit = GitCommit.from(squashObject);
    const squashParsed = squashCommit.parse();
    // Combine commit messages
    const combinedMessage = `${headParsed.message}\n\n${squashParsed.message}`;

    // Create a new commit that replaces the previous one, combining both changes
    const newCommit = await _writeCommit({
      commit: {
        author: headParsed.author, // Keep original author
        committer: {
          ...headParsed.committer,
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: new Date().getTimezoneOffset()
        },
        message: combinedMessage,
        parent: headParsed.parent, // Use the parent of the original commit
        tree: squashParsed.tree // Use the tree after applying squash changes
      },
      fs: fs as any,
      gitdir
    });

    // Update HEAD to new combined commit
    await _writeRef({
      fs,
      gitdir,
      ref: "HEAD",
      value: newCommit
    });

    return {};
  } catch {
    return {
      conflicts: [item.commit]
    };
  }
}

async function executeFixup(cache: Cache, dir: string, fs: FileSystem, gitdir: string, item: RebaseTodoItem) {
  // Fixup: Combine this commit with the previous one, discarding this commit's message
  try {
    // Apply the commit changes (cherry-pick with no-commit)
    await _cherryPick({
      cache,
      dir,
      fs,
      gitdir,
      noCommit: true,
      oid: item.commit
    });

    // Get the current HEAD commit (previous commit)
    const headOid = await _resolveRef({ cache, fs, gitdir, ref: "HEAD" });

    const { object: headObject } = await _readObject({
      cache,
      fs: fs as any,
      gitdir,
      oid: String(headOid)
    });

    const headCommit = GitCommit.from(headObject);
    const headParsed = headCommit.parse();

    // Get the fixup commit info (for tree)
    const { object: fixupObject } = await _readObject({
      cache,
      fs: fs as any,
      gitdir,
      oid: item.commit
    });

    const fixupCommit = GitCommit.from(fixupObject);
    const fixupParsed = fixupCommit.parse();

    // Create a new commit that replaces the previous one with combined changes
    // but keeps only the original commit message (discard fixup message)
    const newCommit = await _writeCommit({
      commit: {
        author: headParsed.author, // Keep original author
        committer: {
          ...headParsed.committer,
          timestamp: Math.floor(Date.now() / 1000),
          timezoneOffset: new Date().getTimezoneOffset()
        },
        message: String(headParsed.message), // Keep only the original message
        parent: headParsed.parent, // Use the parent of the original commit
        tree: fixupParsed.tree // Use the tree after applying fixup changes
      },
      fs: fs as any,
      gitdir
    });

    // Update HEAD to new combined commit
    await _writeRef({
      fs,
      gitdir,
      ref: "HEAD",
      value: newCommit
    });

    return {};
  } catch {
    return {
      conflicts: [item.commit]
    };
  }
}

async function executeExec(_cache: Cache, dir: string, _fs: FileSystem, _gitdir: string, item: RebaseTodoItem) {
  const command = String(item.message).trim();

  if (!command) {
    return {
      conflicts: [],
      message: "No command specified for exec",
      success: false
    };
  }

  try {
    // Execute the command using Deno.Command with shell interpretation
    const process = new Deno.Command("sh", {
      args: ["-c", command],
      cwd: dir,
      stderr: "piped",
      stdout: "piped"
    });

    const { code, stderr, stdout } = await process.output();

    // Convert output to strings
    const stdoutText = new TextDecoder().decode(stdout);
    const stderrText = new TextDecoder().decode(stderr);

    // Log output for user visibility
    if (stdoutText)
      console.log(stdoutText);

    if (stderrText)
      console.error(stderrText);

    if (code === 0) {
      return {
        conflicts: [],
        message: `Successfully executed: ${command}`,
        success: true
      };
    } else {
      return {
        conflicts: [],
        message: `Command failed with exit code ${code}: ${command}`,
        success: false
      };
    }

  } catch (error) {
    return {
      conflicts: [],
      message: `Failed to execute command: ${(error as Error).message}`,
      success: false
    };
  }
}


/**
 * Helper functions
 */

async function resolveCommit(fs: FileSystem, gitdir: string, cache: Cache, ref: string): Promise<string> {
  const oid = await _resolveRef({ cache, fs, gitdir, ref });
  if (!oid)
    throw new NotFoundError(ref);

  return oid;
}

async function getCommitRange({
  cache,
  from,
  fs,
  gitdir,
  to
}: {
  cache: Cache;
  from: string;
  fs: FileSystem;
  gitdir: string;

  to: string;
}): Promise<Array<{ oid: string; message: string }>> {
  // Implement proper commit range walking
  const commits: Array<{ oid: string; message: string }> = [];

  try {
    // Resolve the 'to' and 'from' references to commit OIDs
    const toOid = await _resolveRef({ cache, fs, gitdir, ref: to });
    const fromOid = await _resolveRef({ cache, fs, gitdir, ref: from });

    if (!toOid || !fromOid)
      return commits;

    // Walk backwards from 'to' until we reach 'from' (or a common ancestor)
    const visited = new Set<string>();
    const stack = [toOid];

    while (stack.length > 0) {
      const currentOid = stack.pop()!;

      // Skip if we've already processed this commit
      if (visited.has(currentOid))
        continue;

      visited.add(currentOid);

      // Stop if we've reached the 'from' commit (don't include it)
      if (currentOid === fromOid)
        break;

      try {
        // Get the commit object
        const { object, type } = await _readObject({
          cache,
          fs: fs as any,
          gitdir,
          oid: currentOid
        });

        if (type !== "commit")
          continue;

        const commit = GitCommit.from(object);
        const parsed = commit.parse();

        // Add this commit to our list (in reverse chronological order)
        commits.push({
          message: String(parsed.message),
          oid: currentOid
        });

        // Add parent commits to the stack for processing
        for (const parentOid of parsed.parent) {
          if (!visited.has(parentOid))
            stack.push(parentOid);
        }
      } catch {
        // Skip commits we can't read
        continue;
      }
    }

    // Reverse the commits to get them in chronological order (oldest first)
    // This is the order they should be applied during rebase
    commits.reverse();

    return commits;
  } catch {
    // If we can't resolve refs or walk commits, return empty array
    return [];
  }
}

async function getCurrentBranchName(fs: FileSystem, gitdir: string): Promise<string> {
  try {
    const head = await fs.readFile(join(gitdir, "HEAD"));
    const headText = typeof head === 'string' ? head : new TextDecoder().decode(head);

    if (headText.startsWith("ref: ")) {
      return headText.slice(5).trim();
    }

    return "HEAD"; // Detached HEAD
  } catch {
    return "HEAD";
  }
}

async function checkoutCommit({
  cache,
  dir,
  fs,
  gitdir,
  oid
}: {
  cache: Cache;
  dir: string;
  fs: FileSystem;
  gitdir: string;
  oid: string;
}): Promise<void> {
  // Implement proper checkout using the existing checkout command
  try {
    await _checkout({
      cache,
      dir,
      fs: fs as any,
      gitdir,
      ref: oid, // Checkout the specific commit
      force: false,
      filepaths: [], // Checkout all files
      remote: undefined,
      noUpdateHead: true // Don't update HEAD - rebase will handle that
    });
  } catch (error) {
    throw new Error(`Failed to checkout commit ${oid}: ${(error as Error).message}`);
  }
}

async function saveRebaseState(fs: FileSystem, gitdir: string, state: RebaseState): Promise<void> {
  const rebaseDir = join(gitdir, REBASE_PATHS.DIR);

  // Create rebase directory
  await (fs as any).mkdir(rebaseDir, { recursive: true });

  // Save state files
  await fs.writeFile(join(rebaseDir, REBASE_PATHS.ONTO), new TextEncoder().encode(state.onto));
  await fs.writeFile(join(rebaseDir, REBASE_PATHS.ORIG_HEAD), new TextEncoder().encode(state.orig_head));
  await fs.writeFile(join(rebaseDir, REBASE_PATHS.HEAD_NAME), new TextEncoder().encode(state.head_name));

  if (state.interactive) {
    await fs.writeFile(join(rebaseDir, REBASE_PATHS.INTERACTIVE), new TextEncoder().encode(""));
  }

  // Save todo list
  const todoText = formatRebaseTodo(state.todo.slice(state.current));
  await fs.writeFile(join(rebaseDir, REBASE_PATHS.TODO), new TextEncoder().encode(todoText));

  // Save done list
  const doneItems = state.todo.slice(0, state.current);
  const doneText = formatRebaseTodo(doneItems);
  await fs.writeFile(join(rebaseDir, REBASE_PATHS.DONE), new TextEncoder().encode(doneText));
}

async function loadRebaseState(fs: FileSystem, gitdir: string): Promise<RebaseState | null> {
  const rebaseDir = join(gitdir, REBASE_PATHS.DIR);

  try {
    const ontoData = await fs.readFile(join(rebaseDir, REBASE_PATHS.ONTO));
    const onto = typeof ontoData === 'string' ? ontoData : new TextDecoder().decode(ontoData);
    const origHeadData = await fs.readFile(join(rebaseDir, REBASE_PATHS.ORIG_HEAD));
    const origHead = typeof origHeadData === 'string' ? origHeadData : new TextDecoder().decode(origHeadData);
    const headNameData = await fs.readFile(join(rebaseDir, REBASE_PATHS.HEAD_NAME));
    const headName = typeof headNameData === 'string' ? headNameData : new TextDecoder().decode(headNameData);

    const interactive = await fs.exists?.(join(rebaseDir, REBASE_PATHS.INTERACTIVE)) ?? false;

    // Load todo and done lists
    const todoData = await fs.readFile(join(rebaseDir, REBASE_PATHS.TODO));
    const todoText = typeof todoData === 'string' ? todoData : new TextDecoder().decode(todoData);
    const doneData = await fs.readFile(join(rebaseDir, REBASE_PATHS.DONE));
    const doneText = typeof doneData === 'string' ? doneData : new TextDecoder().decode(doneData);

    const todoItems = parseRebaseTodo(todoText);
    const doneItems = parseRebaseTodo(doneText);

    return {
      onto,
      orig_head: origHead,
      head_name: headName,
      todo: [...doneItems, ...todoItems],
      current: doneItems.length,
      interactive
    };
  } catch {
    return null;
  }
}

async function cleanupRebaseState(fs: FileSystem, gitdir: string): Promise<void> {
  const rebaseDir = join(gitdir, REBASE_PATHS.DIR);

  try {
    await fs.rmdir(rebaseDir, { recursive: true });
  } catch {
    // Ignore errors
  }
}

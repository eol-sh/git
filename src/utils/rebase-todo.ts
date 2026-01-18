/**
 * @fileoverview rebase-todo utility functions
 *
 * Utility functions for rebase-todo operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/rebase-todo.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
 * Rebase todo list parser and formatter
 */

import { RebaseTodoItem, RebaseCommand, REBASE_COMMANDS } from "../models/rebase-state.ts";

/**
 * Parse a git rebase todo list from text
 */
export function parseRebaseTodo(todoText: string): RebaseTodoItem[] {
  const lines = todoText.split("\n");
  const items: RebaseTodoItem[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    
    const item = parseTodoLine(trimmed);
    if (item) {
      items.push(item);
    }
  }
  
  return items;
}

/**
 * Parse a single todo line
 */
function parseTodoLine(line: string): RebaseTodoItem | null {
  // Match: command commit [message]
  // Accept any alphanumeric string as commit (for flexibility in testing)
  const match = line.match(/^(\w+)\s+([a-zA-Z0-9]{4,40})(?:\s+(.+))?$/);
  
  if (!match) {
    // Try exec command: exec command args
    const execMatch = line.match(/^exec\s+(.+)$/);
    if (execMatch) {
      return {
        command: "exec",
        commit: "",
        message: execMatch[1]
      };
    }
    
    // Try break command
    if (line === "break") {
      return {
        command: "break",
        commit: ""
      };
    }
    
    return null;
  }
  
  const [, command, commit, message] = match;
  
  // Validate command
  if (!isValidRebaseCommand(command)) {
    return null;
  }
  
  return {
    command: command as RebaseCommand,
    commit,
    message
  };
}

/**
 * Check if command is valid
 */
function isValidRebaseCommand(command: string): boolean {
  const validCommands = Object.values(REBASE_COMMANDS);
  return validCommands.includes(command as RebaseCommand);
}

/**
 * Format todo items back to text
 */
export function formatRebaseTodo(items: RebaseTodoItem[]): string {
  const lines = items.map(item => formatTodoItem(item));
  
  // Add helpful comments
  const comments = [
    "",
    "# Rebase todo list",
    "#",
    "# Commands:",
    "# p, pick <commit> = use commit",
    "# r, reword <commit> = use commit, but edit the commit message", 
    "# e, edit <commit> = use commit, but stop for amending",
    "# s, squash <commit> = use commit, but meld into previous commit",
    "# f, fixup <commit> = like \"squash\", but discard this commit's log message",
    "# x, exec <command> = run command (the rest of the line) using shell",
    "# b, break = stop here (continue rebase later with 'git rebase --continue')",
    "# d, drop <commit> = remove commit",
    "# l, label <label> = label current HEAD with a name",
    "# t, reset <label> = reset HEAD to a label",
    "# m, merge [-C <commit> | -c <commit>] <label> [# <oneline>]",
    "#",
    "# These lines can be re-ordered; they are executed from top to bottom.",
    "#",
    "# If you remove a line here THAT COMMIT WILL BE LOST.",
    "#",
    "# However, if you remove everything, the rebase will be aborted.",
    "#"
  ];
  
  return lines.concat(comments).join("\n");
}

/**
 * Format a single todo item
 */
function formatTodoItem(item: RebaseTodoItem): string {
  const { command, commit, message } = item;
  
  switch (command) {
    case "exec":
      return `exec ${message || ""}`;
      
    case "break":
      return "break";
      
    case "label":
    case "reset":
      return `${command} ${message || commit}`;
      
    case "merge":
      return `merge ${commit}${message ? ` # ${message}` : ""}`;
      
    default:
      // Standard commands: pick, reword, edit, squash, fixup, drop
      return `${command} ${commit}${message ? ` ${message}` : ""}`;
  }
}

/**
 * Create a default todo list from commit range
 */
export function createDefaultTodoList(commits: Array<{ oid: string; message: string }>): RebaseTodoItem[] {
  return commits.map(commit => ({
    command: "pick",
    commit: commit.oid.slice(0, 7),
    message: commit.message.split("\n")[0] // First line only
  }));
}

/**
 * Validate a todo list
 */
export function validateTodoList(items: RebaseTodoItem[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (items.length === 0) {
    errors.push("Todo list cannot be empty");
  }
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    
    // Check for valid command
    if (!isValidRebaseCommand(item.command)) {
      errors.push(`Invalid command at line ${i + 1}: ${item.command}`);
    }
    
    // Check commit hash for commands that need it
    if (needsCommit(item.command) && !item.commit) {
      errors.push(`Command ${item.command} at line ${i + 1} requires a commit hash`);
    }
    
    // Check for squash/fixup without previous commit
    if ((item.command === "squash" || item.command === "fixup") && i === 0) {
      errors.push(`Cannot ${item.command} the first commit`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if command needs a commit hash
 */
function needsCommit(command: RebaseCommand): boolean {
  return ![
    "exec",
    "break", 
    "label",
    "reset"
  ].includes(command);
}

/**
 * Apply autosquash to todo list
 */
export function applyAutosquash(items: RebaseTodoItem[]): RebaseTodoItem[] {
  const result = [...items];
  
  // Look for fixup! and squash! commits
  for (let i = 0; i < result.length; i++) {
    const item = result[i];
    const message = item.message || "";
    
    if (message.startsWith("fixup! ")) {
      const targetMessage = message.slice(7);
      const targetIndex = findCommitByMessage(result, targetMessage, i);
      
      if (targetIndex !== -1) {
        // Move fixup commit after target and change command
        const fixupItem = { ...item, command: "fixup" as RebaseCommand };
        result.splice(i, 1); // Remove from current position
        result.splice(targetIndex + 1, 0, fixupItem); // Insert after target
      }
    } else if (message.startsWith("squash! ")) {
      const targetMessage = message.slice(8);
      const targetIndex = findCommitByMessage(result, targetMessage, i);
      
      if (targetIndex !== -1) {
        // Move squash commit after target and change command
        const squashItem = { ...item, command: "squash" as RebaseCommand };
        result.splice(i, 1); // Remove from current position  
        result.splice(targetIndex + 1, 0, squashItem); // Insert after target
      }
    }
  }
  
  return result;
}

/**
 * Find commit by message
 */
function findCommitByMessage(items: RebaseTodoItem[], message: string, before: number): number {
  for (let i = 0; i < before; i++) {
    const item = items[i];
    if (item.message && item.message.includes(message)) {
      return i;
    }
  }
  return -1;
}
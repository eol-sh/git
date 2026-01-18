/**
 * @fileoverview rebase-state model definition
 *
 * Defines the rebase-state class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/rebase-state.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
 * Git rebase state models and types
 */

export interface RebaseState {
  onto: string;
  orig_head: string;
  head_name: string;
  todo: RebaseTodoItem[];
  current: number;
  interactive: boolean;
  abort_safety?: string;
}

export interface RebaseTodoItem {
  command: RebaseCommand;
  commit: string;
  message?: string;
  done?: boolean;
}

export type RebaseCommand = 
  | "pick" 
  | "reword" 
  | "edit" 
  | "squash" 
  | "fixup" 
  | "exec" 
  | "break" 
  | "drop" 
  | "label" 
  | "reset" 
  | "merge";

export interface RebaseOptions {
  onto?: string;
  upstream?: string;
  branch?: string;
  interactive?: boolean;
  preserveMerges?: boolean;
  strategy?: string;
  strategyOption?: string[];
  gpgSign?: string;
  autosquash?: boolean;
  autostash?: boolean;
  onEdit?: (todoList: string) => Promise<string>;
}

export interface RebaseResult {
  success: boolean;
  oid?: string;
  conflicts?: string[];
  aborted?: boolean;
  paused?: boolean;
  message?: string;
}

export type RebaseAction = "continue" | "abort" | "skip";

/**
 * Rebase state file paths
 */
export const REBASE_PATHS = {
  DIR: "rebase-merge",
  TODO: "git-rebase-todo",
  DONE: "done",
  ONTO: "onto",
  ORIG_HEAD: "orig-head", 
  HEAD_NAME: "head-name",
  INTERACTIVE: "interactive",
  ABORT_SAFETY: "abort-safety",
  AUTHOR_SCRIPT: "author-script",
  MESSAGE: "message",
  CURRENT_COMMIT: "stopped-sha"
} as const;

/**
 * Default rebase commands
 */
export const REBASE_COMMANDS = {
  PICK: "pick",
  REWORD: "reword",
  EDIT: "edit",
  SQUASH: "squash", 
  FIXUP: "fixup",
  EXEC: "exec",
  BREAK: "break",
  DROP: "drop",
  LABEL: "label",
  RESET: "reset",
  MERGE: "merge"
} as const;
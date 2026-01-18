/**
 * @fileoverview compare-tree-entry-path utility functions
 *
 * Utility functions for compare-tree-entry-path operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/compare-tree-entry-path.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { compareStrings } from "./compare-strings.ts";

interface TreeEntry {
  mode: string;
  path: string;
}



//// export

export function compareTreeEntryPath(a: TreeEntry, b: TreeEntry): number {
  /*** Git sorts tree entries as if there is a trailing slash on directory names. ***/
  return compareStrings(appendSlashIfDir(a), appendSlashIfDir(b));
}



//// helper

function appendSlashIfDir(entry: TreeEntry): string {
  return entry.mode === "040000" ?
    entry.path + "/" :
    entry.path;
}

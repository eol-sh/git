


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

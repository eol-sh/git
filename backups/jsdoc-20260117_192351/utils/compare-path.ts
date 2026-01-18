


//// util

import { compareStrings } from "./compare-strings.ts";

interface PathEntry {
  path: string;
}



//// export

export function comparePath(a: PathEntry, b: PathEntry): number {
  /*** https://stackoverflow.com/a/40355107 ***/
  return compareStrings(a.path, b.path);
}

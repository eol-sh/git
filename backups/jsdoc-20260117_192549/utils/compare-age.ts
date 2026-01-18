


//// util

import type { CommitObject } from "../types.ts";



//// export

export function compareAge(a: CommitObject, b: CommitObject): number {
  return a.committer.timestamp - b.committer.timestamp;
}

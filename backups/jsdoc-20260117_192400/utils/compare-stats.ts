


//// util

import { normalizeStats } from "./normalize-stats.ts";

interface FileStats {
  ctimeSeconds?: number;
  gid: number;
  ino: number;
  mode: number;
  mtimeSeconds?: number;
  size: number;
  uid: number;
  [key: string]: any;
}



//// export

export function compareStats(
  entry: FileStats,
  stats: FileStats,
  filemode: boolean = true,
  trustino: boolean = true
): boolean {
  /*** Comparison based on the description in Paragraph 4 of
  https://www.kernel.org/pub/software/scm/git/docs/technical/racy-git.txt ***/
  const e = normalizeStats(entry as any);
  const s = normalizeStats(stats as any);

  const staleness = (filemode && e.mode !== s.mode) ||
    e.mtimeSeconds !== s.mtimeSeconds ||
    e.ctimeSeconds !== s.ctimeSeconds ||
    e.uid !== s.uid ||
    e.gid !== s.gid ||
    (trustino && e.ino !== s.ino) ||
    e.size !== s.size;

  return staleness;
}

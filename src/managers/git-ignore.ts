


//// util

import { basename } from "../utils/basename.ts";
import { dirname } from "../utils/dirname.ts";
import ignore from "../compat/ignore.ts";
import { join } from "../utils/join.ts";

interface FileSystemLike {
  exists(filepath: string): Promise<boolean>;
  read(filepath: string, encoding: string): Promise<string>;
}



//// export

export interface GitIgnoreManagerIsIgnoredOptions {
  dir: string;
  filepath: string;
  fs: FileSystemLike;
  gitdir?: string;
}

/*** I’m putting this in a Manager because I reckon it could benefit
from a LOT of caching. ***/
export class GitIgnoreManager {
  static async isIgnored({ dir, filepath, fs, gitdir = join(dir, ".git") }: GitIgnoreManagerIsIgnoredOptions): Promise<boolean> {
    /*** ALWAYS ignore ".git" folders. ***/
    if (basename(filepath) === ".git")
      return true;

    /*** "." is not a valid gitignore entry, so "." is never ignored ***/
    if (filepath === ".")
      return false;

    /*** Check and load exclusion rules from project exclude file (.git/info/exclude) ***/
    const excludesFile = join(gitdir, "info", "exclude");
    let excludes = "";

    if (await fs.exists(excludesFile))
      excludes = await fs.read(excludesFile, "utf8");

    /*** Find all the .gitignore files that could affect this file ***/
    const pairs: Array<{ gitignore: string; filepath: string }> = [
      {
        filepath,
        gitignore: join(dir, ".gitignore")
      }
    ];

    const pieces = filepath.split("/").filter(Boolean);

    for (let i = 1; i < pieces.length; i++) {
      const folder = pieces.slice(0, i).join("/");
      const file = pieces.slice(i).join("/");

      pairs.push({
        filepath: file,
        gitignore: join(dir, folder, ".gitignore")
      });
    }

    let ignoredStatus = false;

    for (const p of pairs) {
      let file: string | undefined;

      try {
        file = await fs.read(p.gitignore, "utf8");
      } catch(err: unknown) {
        const error = err as any;

        if (error.code === "NOENT")
          continue;
      }

      const ign = (ignore as any)().add(excludes);

      if (file)
        ign.add(file);

      /*** If the parent directory is excluded, we are done.
      "It is not possible to re-include a file if a parent directory of that file is excluded. Git doesn’t list excluded directories for performance reasons, so any patterns on contained files have no effect, no matter where they are defined."
      source: https://git-scm.com/docs/gitignore ***/
      const parentdir = dirname(p.filepath);

      if (parentdir !== "." && ign.ignores(parentdir))
        return true;

      /*** If the file is currently ignored, test for UNignoring. ***/
      if (ignoredStatus)
        ignoredStatus = !ign.test(p.filepath).unignored;
      else
        ignoredStatus = ign.test(p.filepath).ignored;
    }

    return ignoredStatus;
  }
}

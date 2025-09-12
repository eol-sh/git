


//// util

import { join } from "../utils/join.ts";
import type { FsInterface } from "../types.ts";

interface InitOptions {
  bare?: boolean;
  defaultBranch?: string;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
}



//// export

/**
 * Initialize a new repository
 */
export async function _init({
  bare = false,
  defaultBranch = "primary",
  dir,
  fs,
  gitdir = bare ?
    dir :
    join(dir!, ".git")
}: InitOptions): Promise<void> {
  /*** Don’t overwrite an existing config ***/
  try {
    await fs.lstat(gitdir + "/config");
    return;
  } catch {
    /*** Config doesn’t exist, proceed with initialization ***/
  }

  let folders = [
    "hooks",
    "info",
    "objects/info",
    "objects/pack",
    "refs/heads",
    "refs/tags",
  ];

  folders = folders.map((dir) => gitdir + "/" + dir);

  for (const folder of folders) {
    await fs.mkdir(folder);
  }

  await fs.writeFile(
    gitdir + "/config",
    new TextEncoder().encode(
      "[core]\n" +
        "\trepositoryformatversion = 0\n" +
        "\tfilemode = false\n" +
        `\tbare = ${bare}\n` +
        (bare ? "" : "\tlogallrefupdates = true\n") +
        "\tsymlinks = false\n" +
        "\tignorecase = true\n"
    ),
  );

  await fs.writeFile(gitdir + "/HEAD", new TextEncoder().encode(`ref: refs/heads/${defaultBranch}\n`));
}

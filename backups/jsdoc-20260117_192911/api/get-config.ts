


//// util

import { _getConfig } from "../commands/get-config.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type { FsClient } from "../types.ts";

interface GetConfigOptions {
  dir?: string;
  fs: FsClient;
  gitdir?: string;
  path: string;
}



//// export

/**
 * Read an entry from the git config files.
 */
export async function getConfig({
  dir,
  fs,
  gitdir = join(dir!, ".git"),
  path
}: GetConfigOptions): Promise<any> {
  try {
    assertParameter("fs", fs);
    assertParameter("gitdir", gitdir);
    assertParameter("path", path);

    return await _getConfig({
      fs,
      gitdir,
      path
    });
  } catch(err: unknown) {
    (err as any).caller = "git.getConfig";
    throw err;
  }
}

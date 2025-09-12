


//// util

import { adaptFsForGitConfig } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { Cache, FsInterface } from "../types.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import { join } from "../utils/join.ts";

interface SetConfigOptions {
  append?: boolean;
  cache?: Cache;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
  path: string;
  value: string | boolean | number | undefined;
}



//// export

/**
 * Write an entry to the git config files.
 *
 * *Caveats:*
 * - Currently only the local `$GIT_DIR/config` file can be read or written. However support for the global `~/.gitconfig` and system `$(prefix)/etc/gitconfig` will be added in the future.
 * - The current parser does not support the more exotic features of the git-config file format such as `[include]` and `[includeIf]`.
 */
export async function setConfig({
  append = false,
  dir,
  fs: _fs,
  gitdir = join(dir!, ".git"),
  path,
  value
}: SetConfigOptions): Promise<void> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("path", path);
    // assertParameter("value", value) /*** We actually allow "undefined" as a value to unset/delete ***/

    const adaptedFs = adaptFsForGitConfig(new FileSystem(_fs));
    const config = await GitConfigManager.get({ fs: adaptedFs, gitdir });

    if (append)
      await config.append(path, value);
    else
      await config.set(path, value);

    await GitConfigManager.save({ config, fs: adaptedFs, gitdir });
  } catch(err: unknown) {
    (err as any).caller = "git.setConfig";
    throw err;
  }
}

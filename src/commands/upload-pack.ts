


//// util

import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { join } from "../utils/join.ts";
import { writeRefsAdResponse } from "../wire/write-refs-ad-response.ts";

import type { FsInterface } from "../types.ts";

interface UploadPackOptions {
  advertiseRefs?: boolean;
  dir?: string;
  fs: FsInterface;
  gitdir?: string;
}

interface RefsMap {
  [key: string]: string;
}



//// export

export async function uploadPack({
  advertiseRefs = false,
  dir,
  fs,
  gitdir = join(dir, ".git")
}: UploadPackOptions): Promise<Uint8Array | undefined> {
  const unifiedFs = adaptFsInterface(fs);

  try {
    if (advertiseRefs) {
      // Send a refs advertisement
      const capabilities = [
        "thin-pack",
        "side-band",
        "side-band-64k",
        "shallow",
        "deepen-since",
        "deepen-not",
        "allow-tip-sha1-in-want",
        "allow-reachable-sha1-in-want",
      ];

      let keys = await GitRefManager.listRefs({
        filepath: "refs",
        fs,
        gitdir
      });

      keys = keys.map((ref) => `refs/${ref}`);
      const refs: RefsMap = {};
      keys.unshift("HEAD"); /*** HEAD must be the first in the list ***/

      for (const key of keys) {
        refs[key] = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: key });
      }

      const symrefs: RefsMap = {};

      symrefs.HEAD = await GitRefManager.resolve({
        depth: 2,
        fs,
        gitdir,
        ref: "HEAD"
      });

      return writeRefsAdResponse({
        capabilities,
        refs,
        symrefs
      });
    }
  } catch(err: unknown) {
    (err as any).caller = "git.uploadPack";
    throw err;
  }
}

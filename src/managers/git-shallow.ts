


//// util

import AsyncLock from "../compat/async-lock.ts";
import { FsInterface } from "../types.ts";
import { join } from "../utils/join.ts";

interface ReadOptions {
  fs: FsInterface;
  gitdir: string;
}

interface WriteOptions {
  fs: FsInterface;
  gitdir: string;
  oids: Set<string>;
}

let lock: AsyncLock | null = null;



//// export

export class GitShallowManager {
  static async read({ fs, gitdir }: ReadOptions): Promise<Set<string>> {
    if (lock === null)
      lock = new AsyncLock();

    const filepath = join(gitdir, "shallow");
    const oids = new Set<string>();

    await lock.acquire(filepath, async() => {
      const text = await (fs as any).read(filepath, { encoding: "utf8" });

      if (text === null)
        return oids; /*** no file ***/

      if (text.trim() === "")
        return oids; /*** empty file ***/

      text
        .trim()
        .split("\n")
        .map((oid) => oids.add(oid));

      return oids;
    });

    return oids;
  }

  static async write({ fs, gitdir, oids }: WriteOptions): Promise<void> {
    if (lock === null)
      lock = new AsyncLock();

    const filepath = join(gitdir, "shallow");

    if (oids.size > 0) {
      const text = [...oids].join("\n") + "\n";

      await lock.acquire(filepath, async() => {
        await (fs as any).write(filepath, text, { encoding: "utf8" });
      });
    } else {
      /*** No shallows ***/
      await lock.acquire(filepath, async() => {
        await fs.unlink(filepath);
      });
    }
  }
}

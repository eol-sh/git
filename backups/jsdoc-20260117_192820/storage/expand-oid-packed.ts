


//// util

import { InternalError } from "../errors/internal.ts";
import { join } from "../utils/join.ts";
import { readPackIndex } from "../storage/read-pack-index.ts";

import type { FsInterface } from "../types.ts";

interface ExpandOidPackedOptions {
  cache: Map<string, any>;
  fs: FsInterface;
  getExternalRefDelta?: (oid: string) => Promise<{ type?: string; object: Uint8Array } | undefined>;
  gitdir: string;
  oid: string;
}



//// export

export async function expandOidPacked({
  cache,
  fs,
  getExternalRefDelta,
  gitdir,
  oid: short
}: ExpandOidPackedOptions): Promise<string[]> {
  /*** Iterate through all the .pack files ***/
  const results: string[] = [];
  const list = await fs.readdir(join(gitdir, "objects/pack"));

  /*** Handle both Deno and Node.js readdir return types ***/
  const fileList = Array.isArray(list) ?
    list :
    await (async () => {
      const result: string[] = [];

      for await (const entry of list as AsyncIterable<{ name: string }>) {
        result.push(entry.name);
      }

      return result;
    })();

  const indexFiles = fileList.filter((x) => x.endsWith(".idx"));

  for (const filename of indexFiles) {
    const indexFile = `${gitdir}/objects/pack/${filename}`;

    const p = await readPackIndex({
      cache,
      filename: indexFile,
      fs,
      ...(getExternalRefDelta ? { getExternalRefDelta } : {})
    });

    if ((p as any).error)
      throw new InternalError((p as any).error);

    /*** Search through the list of oids in the packfile ***/
    for (const oid of p.offsets.keys()) {
      if (oid.startsWith(short))
        results.push(oid);
    }
  }

  return results;
}

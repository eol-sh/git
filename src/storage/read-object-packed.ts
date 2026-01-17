


//// util

import { InternalError } from "../errors/internal.ts";
import { join } from "../utils/join.ts";
import { readPackIndex } from "../storage/read-pack-index.ts";

import type { FsInterface } from "../types.ts";

interface ReadObjectPackedOptions {
  cache: Map<string, unknown>;
  format?: "content" | "deflated" | "wrapped";
  fs: FsInterface;
  getExternalRefDelta?: (oid: string) => Promise<{ type?: string; object: Uint8Array } | undefined>;
  gitdir: string;
  oid: string;
}

interface ReadObjectPackedResult {
  format: "content";
  object: Uint8Array;
  source: string;
  type: string;
}



//// export

export async function readObjectPacked({
  cache,
  fs,
  getExternalRefDelta,
  gitdir,
  oid
}: ReadObjectPackedOptions): Promise<ReadObjectPackedResult | null> {
  /*** Check to see if it's in a packfile.
  Iterate through all the .idx files ***/
  let list: string[] | AsyncIterable<{ name: string }>;
  
  try {
    list = await fs.readdir(join(gitdir, "objects/pack"));
  } catch {
    // No pack directory or not accessible
    return null;
  }

  /*** Handle both Deno and Node.js readdir return types ***/
  const fileList = Array.isArray(list) ?
    list :
    await (async () => {
      const result: string[] = [];

      for await (const entry of list as AsyncIterable<{ name: string }>) {
        result.push((entry as { name: string }).name);
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

    /*** If the packfile DOES have the oid we’re looking for... ***/
    if (p.offsets.has(oid)) {
      /*** Get the resolved git object from the packfile ***/
      if (!p.pack) {
        const packFile = indexFile.replace(/idx$/, "pack");
        try {
          p.pack = await fs.readFile(packFile);
        } catch (error) {
          throw new InternalError(`Failed to read packfile ${packFile}: ${error}`);
        }
      }

      const result = await p.read({ oid });

      const typedResult: ReadObjectPackedResult = {
        format: "content",
        object: result.object,
        source: `objects/pack/${filename.replace(/idx$/, "pack")}`,
        type: result.type
      };

      return typedResult;
    }
  }

  /*** Failed to find it ***/
  return null;
}

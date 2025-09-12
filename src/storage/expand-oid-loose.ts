


//// util

import type { FsInterface } from "../types.ts";

interface ExpandOidLooseOptions {
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function expandOidLoose({ fs, gitdir, oid: short }: ExpandOidLooseOptions): Promise<string[]> {
  const prefix = short.slice(0, 2);

  try {
    const objectsSuffixes = await fs.readdir(`${gitdir}/objects/${prefix}`);

    /*** Handle both array and async iterable results ***/
    let suffixes: string[];

    if (Array.isArray(objectsSuffixes)) {
      suffixes = objectsSuffixes;
    } else {
      /*** Handle Deno’s async iterable ***/
      suffixes = [];

      for await (const entry of objectsSuffixes as AsyncIterable<Deno.DirEntry>) {
        suffixes.push(entry.name);
      }
    }

    return suffixes
      .map((suffix) => `${prefix}${suffix}`)
      .filter((_oid) => _oid.startsWith(short));
  } catch {
    /*** Directory doesn’t exist or is empty ***/
    return [];
  }
}

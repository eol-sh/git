


//// util

import { AmbiguousError } from "../errors/ambiguous.ts";
import { expandOidLoose } from "../storage/expand-oid-loose.ts";
import { expandOidPacked } from "../storage/expand-oid-packed.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { _readObject as readObject } from "../storage/read-object.ts";

import type { Cache, FsInterface } from "../types.ts";

interface ExpandOidOptions {
  cache: Cache;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function _expandOid({ cache, fs, gitdir, oid: short }: ExpandOidOptions): Promise<string> {
  /*** Curry the current read method so that the packfile un-deltification
  process can acquire external ref-deltas. ***/
  const getExternalRefDelta = (oid: string) => readObject({ cache, fs, gitdir, oid });
  const results = await expandOidLoose({ fs, gitdir, oid: short });

  const packedOids = await expandOidPacked({
    cache,
    fs,
    getExternalRefDelta,
    gitdir,
    oid: short
  });

  /*** Objects can exist in a pack file as well as loose, make sure we only get a list of unique oids. ***/
  for (const packedOid of packedOids) {
    if (results.indexOf(packedOid) === -1)
      results.push(packedOid);
  }

  if (results.length === 1)
    return results[0];

  if (results.length > 1)
    throw new AmbiguousError("oids", short, results);

  throw new NotFoundError(`an object matching "${short}"`);
}

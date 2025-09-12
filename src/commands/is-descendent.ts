


//// util

import { _readObject } from "../storage/read-object.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitShallowManager } from "../managers/git-shallow.ts";
import { MaxDepthError } from "../errors/max-depth.ts";
import { MissingParameterError } from "../errors/missing-parameter.ts";
import { ObjectTypeError } from "../errors/object-type.ts";

import type { FsInterface } from "../types.ts";

interface IsDescendentOptions {
  ancestor: string;
  cache: Map<string, any>;
  depth: number;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function _isDescendent({
  ancestor,
  cache,
  depth,
  fs,
  gitdir,
  oid
}: IsDescendentOptions): Promise<boolean> {
  const shallows = await GitShallowManager.read({ fs, gitdir });

  if (!oid)
    throw new MissingParameterError("oid");

  if (!ancestor)
    throw new MissingParameterError("ancestor");

  /*** If you don’t like this behavior, add your own check.
  Edge cases are hard to define a perfect solution. ***/
  if (oid === ancestor)
    return false;

  /*** We do not use recursion here, because that would lead to depth-first traversal,
  and we want to maintain a breadth-first traversal to avoid hitting shallow clone depth cutoffs. ***/
  const queue = [oid];
  const visited = new Set<string>();
  let searchdepth = 0;

  while (queue.length) {
    if (searchdepth++ === depth)
      throw new MaxDepthError(depth);

    const currentOid = queue.shift()!;

    const { object, type } = await _readObject({
      cache,
      fs,
      gitdir,
      oid: currentOid
    });

    if (type !== "commit")
      throw new ObjectTypeError(currentOid, (type || "blob") as any, "commit");

    const commit = GitCommit.from(object).parse();

    /*** Are any of the parents the sought-after ancestor? ***/
    for (const parent of commit.parent) {
      if (parent === ancestor)
        return true;
    }

    /*** If not, add them to heads (unless we know this is a shallow commit) ***/
    if (!shallows.has(currentOid)) {
      for (const parent of commit.parent) {
        if (!visited.has(parent)) {
          queue.push(parent);
          visited.add(parent);
        }
      }
    }

    /*** Eventually, we’ll travel entire tree to the roots where all the parents are empty arrays,
    or hit the shallow depth and throw an error. Excluding the possibility of grafts, or
    different branches cloned to different depths, you would hit this error at the same time
    for all parents, so trying to continue is futile. ***/
  }

  return false;
}

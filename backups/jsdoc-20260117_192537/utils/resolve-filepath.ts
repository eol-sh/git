


//// util

import { GitTree } from "../models/git-tree.ts";
import { InvalidFilepathError } from "../errors/invalid-filepath.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { ObjectTypeError } from "../errors/object-type.ts";
import { _readObject as readObject } from "../storage/read-object.ts";
import { resolveTree } from "../utils/resolve-tree.ts";

import type { FsInterface } from "../types.ts";

interface _ResolveFilepathOptions {
  cache: Map<string, any>;
  filepath: string;
  fs: FsInterface;
  gitdir: string;
  oid: string;
  pathArray: string[];
  tree: GitTree;
}

interface ResolveFilepathOptions {
  cache: Map<string, any>;
  filepath: string;
  fs: FsInterface;
  gitdir: string;
  oid: string;
}



//// export

export async function resolveFilepath({
  cache,
  filepath,
  fs,
  gitdir,
  oid
}: ResolveFilepathOptions): Promise<string> {
  /*** Ensure there are no leading or trailing directory separators.
  Git Terminal for Windows auto-expands --filepath=/src/utils to --filepath=C:/Users/USER/AppData/Local/Programs/Git/src/utils
  It would be wise to promote the behavior in the application layer not just the library layer. ***/
  if (filepath.startsWith("/"))
    throw new InvalidFilepathError("leading-slash");
  else if (filepath.endsWith("/"))
    throw new InvalidFilepathError("trailing-slash");

  const _oid = oid;
  const result = await resolveTree({ cache, fs, gitdir, oid });
  const tree = result.tree;
  let resultOid = result.oid;

  if (filepath === "") {
    return resultOid;
  } else {
    const pathArray = filepath.split("/");

    resultOid = await _resolveFilepath({
      cache,
      filepath,
      fs,
      gitdir,
      oid: _oid,
      pathArray,
      tree
    });
  }

  return resultOid;
}



//// helper

async function _resolveFilepath({
  cache,
  filepath,
  fs,
  gitdir,
  oid,
  pathArray,
  tree
}: _ResolveFilepathOptions): Promise<string> {
  const name = pathArray.shift()!;
  for (const entry of tree) {
    if (entry.path === name) {
      if (pathArray.length === 0) {
        return entry.oid;
      } else {
        const { object, type } = await readObject({
          cache,
          fs,
          gitdir,
          oid: entry.oid
        });

        if (type !== "tree")
          throw new ObjectTypeError(oid, type as any, "tree", filepath);

        tree = GitTree.from(object);

        return _resolveFilepath({
          cache,
          filepath,
          fs,
          gitdir,
          oid,
          pathArray,
          tree
        });
      }
    }
  }

  throw new NotFoundError(`file or directory found at "${oid}:${filepath}"`);
}

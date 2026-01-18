


//// util

import { _readObject } from "../storage/read-object.ts";
import { _readTree } from "../commands/read-tree.ts";
import { adaptFileSystem, adaptFsForGitIgnore, adaptFsForGitRef, adaptFsInterfaceForGitIndex } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { compareStats } from "../utils/compare-stats.ts";
import { FileSystem } from "../models/file-system.ts";
import { GitIgnoreManager } from "../managers/git-ignore.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitTree } from "../models/git-tree.ts";
import { hashObject } from "../utils/hash-object.ts";
import { join } from "../utils/join.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { ObjectTypeError } from "../errors/object-type.ts";

import type { Cache, FsClient, FsInterface, TreeEntry } from "../types.ts";

type StatusResult =
  | "*absent"
  | "*added"
  | "*deleted"
  | "*modified"
  | "*undeleted"
  | "*undeletemodified"
  | "*unmodified"
  | "absent"
  | "added"
  | "deleted"
  | "ignored"
  | "modified"
  | "unmodified";

interface StatusOptions {
  cache?: Cache;
  dir: string;
  filepath: string;
  fs: FsClient;
  gitdir?: string;
}

interface IndexEntry {
  path: string;
  oid: string;
  stats?: any;
}



//// export

/**
 * Tell whether a file has been changed
 */
export async function status({
  cache = new Map(),
  dir,
  filepath,
  fs: _fs,
  gitdir = join(dir, ".git")
}: StatusOptions): Promise<StatusResult> {
  try {
    assertParameter("fs", _fs);
    assertParameter("gitdir", gitdir);
    assertParameter("filepath", filepath);

    const fileSystem = new FileSystem(_fs);
    const unifiedFs = adaptFileSystem(fileSystem);
    const ignoreFs = adaptFsForGitIgnore(fileSystem);
    const refFs = adaptFsForGitRef(fileSystem);

    const ignored = await GitIgnoreManager.isIgnored({
      dir,
      filepath,
      fs: ignoreFs,
      gitdir
    });

    if (ignored)
      return "ignored";

    const headTree = await getHeadTree({ cache, gitdir, refFs, unifiedFs });

    const treeOid = await getOidAtPath({
      cache,
      gitdir,
      path: filepath,
      tree: headTree,
      unifiedFs
    });

    const indexEntry = await GitIndexManager.acquire(
      { cache, fs: adaptFsInterfaceForGitIndex(_fs), gitdir },
      (index: any): IndexEntry | null => {
        for (const entry of index) {
          if (entry.path === filepath)
            return entry;
        }

        return null;
      }
    );

    const stats = await fileSystem.lstat(join(dir, filepath));
    const H = treeOid !== null;    /*** head ***/
    const I = indexEntry !== null; /*** index ***/
    const W = stats !== null;      /*** working dir ***/

    const getWorkdirOid = async(): Promise<string> => {
      if (I && indexEntry && stats && indexEntry.stats && !compareStats(indexEntry.stats, stats as any)) {
        return indexEntry.oid;
      } else {
        const object = await fileSystem.read(join(dir, filepath));

        if (!object)
          throw new Error(`Unable to read file: ${filepath}`);

        const buffer = typeof object === "string" ?
          new TextEncoder().encode(object) :
          object;

        const workdirOid = await hashObject({ gitdir, object: buffer, type: "blob" });

        /*** If the oid in the index === working dir oid but stats differed update cache ***/
        if (I && indexEntry && indexEntry.oid === workdirOid) {
          /*** and as long as our fs.stats aren’t bad.
          size of -1 happens over a BrowserFS HTTP Backend that doesn’t serve Content-Length headers
          (like the Karma webserver) because BrowserFS HTTP Backend uses HTTP HEAD requests to do fs.stat ***/
          if (stats && stats.size !== -1) {
            /*** We don’t await this so we can return faster for one-off cases. ***/
            GitIndexManager.acquire({ cache, fs: adaptFsInterfaceForGitIndex(_fs), gitdir }, (index: any) => {
              index.insert({ filepath, oid: workdirOid, stats });
            });
          }
        }

        return workdirOid;
      }
    };

    if (!H && !W && !I)
      return "absent";  /*** --- ***/

    if (!H && !W && I)
      return "*absent"; /*** -A- ***/

    if (!H && W && !I)
      return "*added";  /*** --A ***/

    if (!H && W && I) {
      const workdirOid = await getWorkdirOid();

      return workdirOid === indexEntry!.oid ?
        "added" :
        "*added"; /*** -AA : -AB ***/
    }

    if (H && !W && !I)
      return "deleted"; /*** A-- ***/

    if (H && !W && I) {
      return treeOid === indexEntry!.oid ?
        "*deleted" :
        "*deleted"; /*** AA- : AB- ***/
    }

    if (H && W && !I) {
      const workdirOid = await getWorkdirOid();

      return workdirOid === treeOid ?
        "*undeleted" :
        "*undeletemodified"; /*** A-A : A-B ***/
    }

    if (H && W && I) {
      const workdirOid = await getWorkdirOid();

      if (workdirOid === treeOid) {
        return workdirOid === indexEntry!.oid ?
          "unmodified" :
          "*unmodified"; /*** AAA : ABA ***/
      } else {
        return workdirOid === indexEntry!.oid ?
          "modified" :
          "*modified"; /*** ABB : AAB ***/
      }
    }

    /*** Should never reach here ***/
    throw new Error("Unexpected status calculation state");
  } catch(err: unknown) {
    (err as any).caller = "git.status";
    throw err;
  }
}



//// helper

async function getHeadTree({
  cache,
  gitdir,
  refFs,
  unifiedFs
}: {
  cache: Cache;
  gitdir: string;
  refFs: any;
  unifiedFs: FsInterface;
}): Promise<TreeEntry[]> {
  /*** Get the tree from the HEAD commit. ***/
  let oid: string;

  try {
    oid = await GitRefManager.resolve({ fs: refFs, gitdir, ref: "HEAD" });
  } catch(e) {
    /*** Handle fresh branches with no commits ***/
    if (e instanceof NotFoundError)
      return [];

    throw e;
  }

  const { tree } = await _readTree({ cache, fs: unifiedFs, gitdir, oid });
  return tree;
}

async function getOidAtPath({
  cache,
  gitdir,
  path,
  tree,
  unifiedFs
}: {
  cache: Cache;
  gitdir: string;
  path: string | string[];
  tree: TreeEntry[];
  unifiedFs: FsInterface;
}): Promise<string | null> {
  const pathArray = typeof path === "string" ?
    path.split("/") :
    path;

  const dirname = pathArray.shift();

  for (const entry of tree) {
    if (entry.path === dirname) {
      if (pathArray.length === 0)
        return entry.oid;

      const { object, type } = await _readObject({
        cache,
        fs: unifiedFs,
        gitdir,
        oid: entry.oid
      });

      if (type === "tree") {
        const tree = GitTree.from(object);

        return getOidAtPath({
          cache,
          gitdir,
          path: pathArray,
          tree: tree.entries(),
          unifiedFs
        });
      }

      if (type === "blob")
        throw new ObjectTypeError(entry.oid, type, "blob", pathArray.join("/"));
    }
  }

  return null;
}

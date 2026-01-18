


//// util

import { _readObject } from "../storage/read-object.ts";
import { _walk } from "../commands/walk.ts";
import { _writeObject } from "../storage/write-object.ts";
import { _writeTree } from "../commands/write-tree.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import AsyncLock from "../compat/async-lock.ts";
import { GitIgnoreManager } from "../managers/git-ignore.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { InternalError } from "../errors/internal.ts";
import { join } from "./join.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { posixifyPathBuffer } from "./posixify-path-buffer.ts";
import { readObjectLoose } from "../storage/read-object-loose.ts";
import { STAGE } from "../commands/stage.ts";
import { TREE } from "../commands/tree.ts";
import { WORKDIR } from "../commands/workdir.ts";

import type { Cache, FsInterface, TreeEntry, WalkerEntry } from "../types.ts";

interface TreeMap {
  [key: string]: () => unknown;
}

const _TreeMap: TreeMap = {
  stage: STAGE,
  workdir: WORKDIR
};

interface LockParams {
  currentFilepath?: string;
  dirRemoved?: string[];
  fs: FsInterface;
  gitdir: string;
  ops?: Operation[];
}

interface ProcessedTreeEntry extends TreeEntry {
  children?: ProcessedTreeEntry[];
}

interface Operation {
  filepath: string;
  method: "mkdir" | "rm" | "rmdir" | "write";
  oid?: string;
}

interface StageUpdate {
  filepath: string;
  oid: string;
  stats?: any;
}

interface WriteTreeChangesOptions {
  dir: string;
  fs: FsInterface;
  gitdir: string;
  treePair: [unknown, string] | [unknown, unknown];
}

interface ApplyTreeChangesOptions {
  dir: string;
  fs: FsInterface;
  gitdir: string;
  parentCommit: string;
  stashCommit: string;
  wasStaged: boolean;
}

let lock: AsyncLock | undefined;



//// export

export function acquireLock<T>(ref: LockParams | string, callback: () => Promise<T>): Promise<T> {
  if (lock === undefined)
    lock = new AsyncLock();

  const key = typeof ref === "string" ?
    ref :
    JSON.stringify(ref);

  return lock.acquire(key, callback);
}

export async function applyTreeChanges({
  dir,
  fs,
  gitdir,
  parentCommit,
  stashCommit,
  wasStaged
}: ApplyTreeChangesOptions): Promise<void> {
  const dirRemoved: string[] = [];
  const stageUpdated: StageUpdate[] = [];

  /*** Analyze the changes ***/
  const ops = await _walk({
    cache: {} as Cache,
    dir,
    fs,
    gitdir,
    map: async(
      filepath: string,
      [parent, stash]: any
    ): Promise<any> => {
      if (
        filepath === "." ||
        (await GitIgnoreManager.isIgnored({ dir, filepath, fs: fs as any, gitdir }))
      ) return;

      const type = stash ?
        await stash.type() :
        parent ?
          await parent.type() :
          "blob";

      if (type !== "tree" && type !== "blob")
        return;

      /*** Deleted tree or blob ***/
      if (!stash && parent) {
        const method = type === "tree" ?
          "rmdir" as const :
          "rm" as const;

        if (type === "tree")
          dirRemoved.push(filepath);

        if (type === "blob" && wasStaged)
          stageUpdated.push({ filepath, oid: await parent.oid() }); /*** stats is undefined, will stage the deletion with index.insert ***/

        return { method, filepath };
      }

      if (!stash)
        return;

      const oid = await stash.oid();

      if (!parent || (await parent.oid()) !== oid) {
        /*** Only apply changes if changed from the parent commit or doesn’t exist in the parent commit ***/
        if (type === "tree") {
          return { filepath, method: "mkdir" };
        } else {
          if (wasStaged) {
            const stats = await fs.lstat(join(dir, filepath));

            stageUpdated.push({
              filepath,
              oid,
              stats
            });
          }

          return {
            filepath,
            method: "write",
            oid
          };
        }
      }
    },
    trees: [
      TREE({ ref: parentCommit }),
      TREE({ ref: stashCommit })
    ]
  });

  const operations = (ops as any || []).filter(Boolean) as Operation[];

  /*** Apply the changes to work dir ***/
  await acquireLock({ dirRemoved, fs, gitdir, ops: operations }, async() => {
    for (const op of operations) {
      const currentFilepath = join(dir, op.filepath);

      switch(op.method) {
        case "rmdir": {
          await fs.rmdir(currentFilepath);
          break;
        }

        case "mkdir": {
          await fs.mkdir(currentFilepath);
          break;
        }

        case "rm": {
          await fs.unlink(currentFilepath);
          break;
        }

        case "write": {
          /*** Only writes if file is not in the removedDirs ***/
          if (!dirRemoved.some((removedDir) => currentFilepath.startsWith(removedDir))) {
            const { object } = await _readObject({
              cache: {} as Cache,
              fs,
              gitdir,
              oid: op.oid!
            });

            /*** Just like checkout, since mode only applicable to create, not update, delete first ***/
            if (await fs.lstat(currentFilepath))
              await fs.unlink(currentFilepath);

            await fs.writeFile(currentFilepath, object); /*** Only handles regular files for now ***/
          }

          break;
        }
      }
    }
  });

  /*** Update the stage ***/
  await GitIndexManager.acquire(
    { cache: {} as Cache, fs: adaptFsInterface(fs), gitdir },
    (index) => {
      stageUpdated.forEach(({ filepath, oid, stats }) => {
        index.insert({ filepath, oid, stats });
      });

      return Promise.resolve();
    }
  );
}

export async function writeTreeChanges({
  dir,
  fs,
  gitdir,
  treePair /*** [TREE({ ref: "HEAD" }), "STAGE"] would be the equivalent of `git write-tree` ***/
}: WriteTreeChangesOptions): Promise<string | null> {
  const isStage = treePair[1] === "stage";
  const trees = treePair.map((t) => (typeof t === "string" ? _TreeMap[t]() : t));
  const changedEntries: [WalkerEntry | null, WalkerEntry | null][] = [];

  /*** Transform WalkerEntry objects into the desired format ***/
  const map = async(filepath: string, [head, stage]: [WalkerEntry | null, WalkerEntry | null]): Promise<TreeEntry | undefined> => {
    if (filepath === "." || (await GitIgnoreManager.isIgnored({ dir, filepath, fs: fs as any, gitdir })))
      return;

    if (stage) {
      if (
        !head ||
        ((await head.oid()) !== (await stage.oid()) &&
          (await stage.oid()) !== undefined)
      ) changedEntries.push([head, stage]);

      return {
        mode: (await stage.mode()).toString(),
        oid: await stage.oid(),
        path: filepath,
        type: (await stage.type()) as "blob" | "commit" | "tree"
      };
    }

    return undefined;
  };

  /*** Combine mapped entries with their parent results ***/
  const reduce = (
    parent: ProcessedTreeEntry | undefined,
    children: (TreeEntry | undefined)[]
  ): Promise<ProcessedTreeEntry[] | ProcessedTreeEntry | undefined> =>
    Promise.resolve((() => {
      const filteredChildren = children.filter(Boolean) as TreeEntry[];

      if (!parent) {
        return filteredChildren.length > 0 ?
          filteredChildren :
          undefined;
      } else {
        parent.children = filteredChildren as ProcessedTreeEntry[];
        return parent;
      }
    })());

  /*** If parent is skipped, skip the children ***/
  const iterate = async(
    walk: (child: [WalkerEntry | null, WalkerEntry | null]) => Promise<unknown>,
    children: [WalkerEntry | null, WalkerEntry | null][]
  ): Promise<unknown[]> => {
    const filtered: [WalkerEntry | null, WalkerEntry | null][] = [];

    for (const child of children) {
      const [head, stage] = child;

      if (isStage) {
        if (stage) {
          /*** For deleted file in work dir, it also needs to be added on stage ***/
          if (await fs.lstat(`${dir}/${stage.toString()}`))
            filtered.push(child);
          else
            changedEntries.push([null, stage]); /*** Record the change (deletion) while stop the iteration ***/
        }
      } else if (head) {
        /*** For deleted file in workdir, "stage" (workdir in our case) will be undefined ***/
        if (!stage)
          changedEntries.push([head, null]); /*** Record the change (deletion) while stop the iteration ***/
        else
          filtered.push(child); /*** workdir, tracked only ***/
      }
    }

    return filtered.length ?
      Promise.all(filtered.map(walk)) :
      [];
  };

  const entries = await _walk({
    cache: {} as Cache,
    dir,
    fs,
    gitdir,
    iterate: iterate as any,
    map: map as any,
    reduce: reduce as any,
    trees: trees as any
  });

  if (changedEntries.length === 0 || !entries || (entries as any).length === 0)
    return null; /*** No changes found to stash ***/

  const processedEntries = await processTreeEntries({
    dir,
    entries: Array.isArray(entries) ?
      entries :
      [entries],
    fs,
    gitdir
  });

  const treeEntries = processedEntries.filter(Boolean).map((entry) => ({
    mode: entry.mode,
    oid: entry.oid,
    path: entry.path,
    type: entry.type,
  }));

  return _writeTree({ fs, gitdir, tree: treeEntries });
}



//// helper

/*** Make sure filepath, blob type, and blob object (from loose objects) plus oid are in sync and valid ***/
async function checkAndWriteBlob(
  fs: FsInterface,
  gitdir: string,
  dir: string,
  filepath: string,
  oid: string | null = null
): Promise<string> {
  const currentFilepath = join(dir, filepath);
  const stats = await fs.lstat(currentFilepath);

  if (!stats)
    throw new NotFoundError(currentFilepath);

  if ((stats as any).isDirectory())
    throw new InternalError(`${currentFilepath}: file expected, but found directory`);

  /*** Look for it in the loose object directory. ***/
  const objContent = oid ?
    await readObjectLoose({ fs, gitdir, oid }) :
    undefined;

  let retOid = objContent ?
    oid :
    undefined;

  if (!objContent) {
    await acquireLock({ currentFilepath, fs, gitdir }, async() => {
      const object = (stats as any).isSymbolicLink() ?
        await (fs as any)
          .readlink(currentFilepath)
          .then(posixifyPathBuffer) :
        await (fs as any).read(currentFilepath);

      if (object === null)
        throw new NotFoundError(currentFilepath);

      retOid = await _writeObject({ fs, gitdir, object, type: "blob" });
    });
  }

  return retOid!;
}

function processTreeEntries({
  dir,
  entries,
  fs,
  gitdir
}: {
  dir: string;
  entries: ProcessedTreeEntry[];
  fs: FsInterface;
  gitdir: string;
}): Promise<ProcessedTreeEntry[]> {
  /*** Make sure each tree entry has valid oid ***/
  async function processTreeEntry(entry: ProcessedTreeEntry): Promise<ProcessedTreeEntry> {
    if (entry.type === "tree") {
      if (!entry.oid && entry.children) {
        /*** Process children entries if the current entry is a tree ***/
        const children = await Promise.all(entry.children.map(processTreeEntry));
        /*** Write the tree with the processed children ***/
        entry.oid = await _writeTree({
          fs,
          gitdir,
          tree: children
        });

        entry.mode = "40000"; /*** directory ***/
      }
    } else if (entry.type === "blob") {
      entry.oid = await checkAndWriteBlob(
        fs,
        gitdir,
        dir,
        entry.path,
        entry.oid
      );

      entry.mode = "100644"; /*** file ***/
    }

    /*** Remove path from entry.path ***/
    entry.path = entry.path.split("/").pop() || entry.path;
    return entry;
  }

  return Promise.all(entries.map(processTreeEntry));
}

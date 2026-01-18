/**
 * @fileoverview merge-tree utility functions
 *
 * Utility functions for merge-tree operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/merge-tree.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import { basename } from "./basename.ts";
import { GitIndexInterface } from "../interfaces/git-index.ts";
import { GitTree } from "../models/git-tree.ts";
import { join } from "./join.ts";
import { MergeConflictError } from "../errors/merge-conflict.ts";
import { mergeFile } from "./merge-file.ts";
import { MergeNotSupportedError } from "../errors/merge-not-supported.ts";
import { modified } from "./modified.ts";
import { TREE } from "../commands/tree.ts";
import { _walk } from "../commands/walk.ts";
import { _writeObject as writeObject } from "../storage/write-object.ts";

import type { Cache, FsInterface, MergeDriverCallback, TreeEntry, WalkerEntry } from "../types.ts";

interface MergeBlobsOptions {
  base: WalkerEntry | null;
  baseName?: string;
  dryRun?: boolean;
  fs: FsInterface;
  gitdir: string;
  mergeDriver?: MergeDriverCallback;
  ourName?: string;
  ours: WalkerEntry;
  path: string;
  theirName?: string;
  theirs: WalkerEntry;
}

interface MergeBlobsResult {
  cleanMerge: boolean;
  mergeResult: TreeEntry;
}

interface MergeTreeOptions {
  abortOnConflict?: boolean;
  baseName?: string;
  baseOid: string;
  cache: Cache;
  dir?: string;
  dryRun?: boolean;
  fs: FsInterface;
  gitdir?: string;
  index?: GitIndexInterface;
  mergeDriver?: MergeDriverCallback;
  ourName?: string;
  ourOid: string;
  theirName?: string;
  theirOid: string;
}



//// export

export async function mergeTree({
  abortOnConflict = true,
  baseName = "base",
  baseOid,
  cache,
  dir,
  dryRun = false,
  fs,
  gitdir = join(dir!, ".git"),
  index,
  mergeDriver,
  ourName = "ours",
  ourOid,
  theirName = "theirs",
  theirOid
}: MergeTreeOptions): Promise<string | MergeConflictError> {
  const baseTree = TREE({ ref: baseOid });
  const ourTree = TREE({ ref: ourOid });
  const theirTree = TREE({ ref: theirOid });

  const bothModified: string[] = [];
  const deleteByTheirs: string[] = [];
  const deleteByUs: string[] = [];
  const unmergedFiles: string[] = [];

  const results = await _walk({
    cache,
    dir: dir || "",
    fs,
    gitdir,
    map: async function (filepath: string, entries: any): Promise<TreeEntry | undefined> {
      const [ours, base, theirs] = entries;
      const path = basename(filepath);

      if (!ours)
        return undefined;

      /*** What we did, what they did ***/
      const ourChange = await modified(ours, base);
      const theirChange = await modified(theirs, base);

      switch(`${String(ourChange)}-${String(theirChange)}`) {
        case "false-false": {
          return {
            mode: (await base!.mode()).toString(),
            oid: await base!.oid(),
            path,
            type: (await base!.type()) as "blob" | "commit" | "tree"
          };
        }

        case "false-true": {
          /*** If directory is deleted in theirs but not in ours we return our directory ***/
          if (!theirs && (await ours.type()) === "tree") {
            return {
              mode: (await ours.mode()).toString(),
              oid: await ours.oid(),
              path,
              type: (await ours.type()) as "blob" | "commit" | "tree"
            };
          }

          return theirs ?
            {
              mode: (await theirs!.mode()).toString(),
              oid: await theirs.oid(),
              path,
              type: (await theirs.type()) as "blob" | "commit" | "tree"
            } :
            undefined;
        }

        case "true-false": {
          /*** If directory is deleted in ours but not in theirs we return their directory ***/
          if (!ours && (await theirs!.type()) === "tree") {
            return {
              mode: (await theirs!.mode()).toString(),
              oid: await theirs!.oid(),
              path,
              type: (await theirs!.type()) as "blob" | "commit" | "tree"
            };
          }

          return ours ?
            {
              mode: (await ours.mode()).toString(),
              oid: await ours.oid(),
              path,
              type: (await ours.type()) as "blob" | "commit" | "tree"
            } :
            undefined;
        }

        case "true-true": {
          /*** Handle tree-tree merges (directories) ***/
          if (
            ours &&
            theirs &&
            (await ours.type()) === "tree" &&
            (await theirs.type()) === "tree"
          ) {
            return {
              mode: (await ours.mode()).toString(),
              oid: await ours.oid(),
              path,
              type: "tree"
            };
          }

          /*** Modifications - both are blobs ***/
          if (
            ours &&
            theirs &&
            (await ours.type()) === "blob" &&
            (await theirs.type()) === "blob"
          ) {
            return mergeBlobs({
              base,
              baseName,
              fs,
              gitdir,
              ...(mergeDriver !== undefined ? { mergeDriver } : {}),
              ourName,
              ours,
              path,
              theirName,
              theirs
            }).then(async(r) => {
              if (!r.cleanMerge) {
                unmergedFiles.push(filepath);
                bothModified.push(filepath);

                if (!abortOnConflict && index) {
                  let baseOid = "";

                  if (base && (await base.type()) === "blob")
                    baseOid = await base.oid();

                  const ourOid = await ours.oid();
                  const theirOid = await theirs.oid();

                  index.delete({ filepath });

                  const dummyStats = {
                    dev: 0,
                    gid: 0,
                    ino: 0,
                    mode: 0o100644,
                    size: 0,
                    uid: 0
                  };

                  if (baseOid)
                    index.insert({ filepath, oid: baseOid, stage: 1, stats: dummyStats });

                  index.insert({ filepath, oid: ourOid, stage: 2, stats: dummyStats });
                  index.insert({ filepath, oid: theirOid, stage: 3, stats: dummyStats });
                }
              } else if (!abortOnConflict && index) {
                const dummyStats = {
                  dev: 0,
                  gid: 0,
                  ino: 0,
                  mode: 0o100644,
                  size: 0,
                  uid: 0
                };

                index.insert({ filepath, oid: r.mergeResult.oid, stage: 0, stats: dummyStats });
              }

              return r.mergeResult;
            });
          }

          /*** Deleted by us ***/
          if (
            base &&
            !ours &&
            theirs &&
            (await base.type()) === "blob" &&
            (await theirs.type()) === "blob"
          ) {
            unmergedFiles.push(filepath);
            deleteByUs.push(filepath);

            if (!abortOnConflict && index) {
              const baseOid = await base.oid();
              const theirOid = await theirs.oid();

              index.delete({ filepath });

              const dummyStats = {
                dev: 0,
                gid: 0,
                ino: 0,
                mode: 0o100644,
                size: 0,
                uid: 0
              };

              index.insert({ filepath, oid: baseOid, stage: 1, stats: dummyStats });
              index.insert({ filepath, oid: theirOid, stage: 3, stats: dummyStats });
            }

            return {
              mode: (await theirs!.mode()).toString(),
              oid: await theirs.oid(),
              path,
              type: "blob"
            };
          }

          /*** Deleted by theirs ***/
          if (
            base &&
            ours &&
            !theirs &&
            (await base.type()) === "blob" &&
            (await ours.type()) === "blob"
          ) {
            unmergedFiles.push(filepath);
            deleteByTheirs.push(filepath);

            if (!abortOnConflict && index) {
              const baseOid = await base.oid();
              const ourOid = await ours.oid();

              index.delete({ filepath });

              const dummyStats = {
                dev: 0,
                gid: 0,
                ino: 0,
                mode: 0o100644,
                size: 0,
                uid: 0
              };

              index.insert({ filepath, oid: baseOid, stage: 1, stats: dummyStats });
              index.insert({ filepath, oid: ourOid, stage: 2, stats: dummyStats });
            }

            return {
              mode: (await ours.mode()).toString(),
              oid: await ours.oid(),
              path,
              type: "blob"
            };
          }

          /*** Deleted by both ***/
          if (
            base &&
            !ours &&
            !theirs &&
            ((await base.type()) === "blob" || (await base.type()) === "tree")
          ) return undefined;

          /*** Handle addition conflicts - when both sides add different files at the same path ***/
          if (!base && ours && theirs) {
            /*** Both sides added a file - check if they’re identical ***/
            const ourOid = await ours.oid();
            const theirOid = await theirs.oid();

            if (ourOid === theirOid) {
              /*** Same content, no conflict - use either (we’ll use ours) ***/
              return {
                mode: (await ours.mode()).toString(),
                oid: ourOid,
                path,
                type: (await ours.type()) as "blob" | "tree"
              };
            }

            /*** Different content - this is a real conflict ***/
            if (abortOnConflict)
              throw new MergeConflictError([path], [], [], []);

            /*** Mark as unmerged ***/
            unmergedFiles.push(path);
            return undefined;
          }

          /*** Handle other types of conflicts (one side adds, other deletes, etc.)
          For now, these are not supported ***/
          throw new MergeNotSupportedError();
        }
      }

      return undefined;
    },
    reduce: (unmergedFiles.length !== 0 && (!dir || abortOnConflict)) ?
      undefined as any :
      async(parent: TreeEntry | undefined, children: (TreeEntry | undefined)[]): Promise<TreeEntry | undefined> => {
        const entries = children.filter(Boolean) as TreeEntry[]; /*** remove undefineds ***/

        /*** If the parent was deleted, the children have to go ***/
        if (!parent)
          return;

        /*** Automatically delete directories if they have been emptied
        Except for the root directory ***/
        if (
          parent &&
          parent.type === "tree" &&
          entries.length === 0 &&
          parent.path !== "."
        ) return;

        if (entries.length > 0 || (parent.path === "." && entries.length === 0)) {
          const tree = new GitTree(entries);
          const object = tree.toObject();

          const oid = await writeObject({
            dryRun,
            fs,
            gitdir,
            object,
            type: "tree"
          });

          parent.oid = oid;
        }

        return parent;
      },
    trees: [ourTree, baseTree, theirTree]
  });

  if (unmergedFiles.length !== 0) {
    if (dir && !abortOnConflict) {
      await _walk({
        cache,
        dir,
        fs,
        gitdir,
        map: async(filepath: string, entries: any): Promise<boolean> => {
          const [entry] = entries;
          const path = `${dir}/${filepath}`;

          if ((await entry.type()) === "blob") {
            const rawContent = await entry.content();
            const content = rawContent ? new TextDecoder().decode(rawContent) : "";

            await fs.writeFile(path, new TextEncoder().encode(content));
          }

          return true;
        },
        trees: [TREE({ ref: (results as any).oid })]
      });
    }

    return new MergeConflictError(
      unmergedFiles,
      bothModified,
      deleteByUs,
      deleteByTheirs
    );
  }

  return (results as any).oid;
}



//// helper

async function mergeBlobs({
  base,
  baseName,
  dryRun,
  fs,
  gitdir,
  mergeDriver = mergeFile as any,
  ourName,
  ours,
  path,
  theirName,
  theirs
}: MergeBlobsOptions): Promise<MergeBlobsResult> {
  const type = "blob" as const;
  /*** Compute the new mode.
  Since there are ONLY two valid blob modes ("100755" and "100644") it boils down to this ***/
  let baseContent = "";
  let baseMode = "100755";
  let baseOid = "";

  if (base && (await base.type()) === "blob") {
    baseMode = (await base.mode()).toString();
    baseOid = await base.oid();

    const rawBaseContent = await base.content();
    baseContent = rawBaseContent ? new TextDecoder().decode(rawBaseContent) : "";
  }

  const mode = baseMode === (await ours.mode()).toString() ?
    (await theirs.mode()).toString() :
    (await ours.mode()).toString();

  /*** The trivial case: nothing to merge except maybe `mode` ***/
  if ((await ours.oid()) === (await theirs.oid())) {
    return {
      cleanMerge: true,
      mergeResult: { mode, oid: await ours.oid(), path, type }
    };
  }

  /*** If only one side made oid changes, return that side’s `oid` ***/
  if ((await ours.oid()) === baseOid) {
    return {
      cleanMerge: true,
      mergeResult: { mode, oid: await theirs.oid(), path, type }
    };
  }

  if ((await theirs.oid()) === baseOid) {
    return {
      cleanMerge: true,
      mergeResult: { mode, oid: await ours.oid(), path, type }
    };
  }

  /*** If both sides made changes do a merge ***/
  const rawOurContent = await ours.content();
  const ourContent = rawOurContent ?
    new TextDecoder().decode(rawOurContent) :
    "";

  const rawTheirContent = await theirs.content();
  const theirContent = rawTheirContent ?
    new TextDecoder().decode(rawTheirContent) :
    "";

  const { cleanMerge, mergedText } = await mergeDriver({
    branches: [baseName!, ourName!, theirName!],
    contents: [baseContent, ourContent, theirContent],
    path
  });

  const oid = await writeObject({
    dryRun: dryRun || false,
    fs,
    gitdir,
    object: new TextEncoder().encode(mergedText),
    type: "blob"
  });

  return { cleanMerge, mergeResult: { mode, oid, path, type }};
}

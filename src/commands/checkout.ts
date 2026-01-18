


//// util

import { flat as _flat } from "../utils/flat.ts";
import { _walk } from "./walk.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { CheckoutConflictError } from "../errors/checkout-conflict.ts";
import { CommitNotFetchedError } from "../errors/commit-not-fetched.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import { GitIndexManager } from "../managers/git-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { InternalError } from "../errors/internal.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { _readObject as readObject } from "../storage/read-object.ts";
import { STAGE } from "./stage.ts";
import { TREE } from "./tree.ts";
import { WORKDIR } from "./workdir.ts";
import { worthWalking } from "../utils/worth-walking.ts";

import type { Cache, FsInterface, PostCheckoutCallback, ProgressCallback, WalkerEntry } from "../types.ts";

interface CheckoutOptions {
  batchSize?: number;
  cache: Cache;
  dir: string;
  dryRun?: boolean;
  filepaths?: string[];
  force?: boolean;
  fs: FsInterface;
  gitdir: string;
  noCheckout?: boolean;
  nonBlocking?: boolean;
  noUpdateHead?: boolean;
  onPostCheckout?: PostCheckoutCallback;
  onProgress?: ProgressCallback;
  ref: string;
  remote?: string;
  track?: boolean;
}



//// export

export async function _checkout({
  batchSize = 100,
  cache,
  dir,
  dryRun = false,
  filepaths,
  fs,
  gitdir,
  noCheckout = false,
  nonBlocking = false,
  noUpdateHead = false,
  onPostCheckout,
  onProgress,
  ref,
  remote,
  track = true
}: CheckoutOptions): Promise<void> {
  /*** Create unified adapters for manager compatibility ***/
  const unifiedFs = adaptFsInterface(fs);

  /*** oldOid is defined only if onPostCheckout hook is attached ***/
  let oldOid: string | undefined;

  if (onPostCheckout) {
    try {
      oldOid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: "HEAD" });
    } catch {
      oldOid = "0000000000000000000000000000000000000000";
    }
  }

  /*** Get tree oid ***/
  let oid: string;

  try {
    oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });

    // Handle the case where ref exists but remote is specified
    if (remote && remote !== "origin") {
      // Check if the existing ref tracks a different remote
      const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });
      const currentRemote = await config.get(`branch.${ref}.remote`).catch(() => null);

      if (currentRemote && currentRemote !== remote) {
        // Ref exists but tracks a different remote
        if (track) {
          // Update tracking to new remote
          const remoteRef = `${remote}/${ref}`;
          const remoteOid = await GitRefManager.resolve({
            fs: unifiedFs,
            gitdir,
            ref: remoteRef
          }).catch(() => null);

          if (remoteOid) {
            // Update the branch to point to the new remote's version
            oid = remoteOid;
            await config.set(`branch.${ref}.remote`, remote);
            await config.set(`branch.${ref}.merge`, `refs/heads/${ref}`);
            await GitConfigManager.save({ config, fs: unifiedFs, gitdir });
          }
        }
        // If not tracking, just use the existing local ref
      }
    }
  } catch(err) {
    if (ref === "HEAD")
      throw err;

    /*** If `ref` doesn’t exist, create a new remote tracking branch
    Figure out the commit to checkout ***/
    const remoteRef = `${remote}/${ref}`;

    oid = await GitRefManager.resolve({
      fs: unifiedFs,
      gitdir,
      ref: remoteRef
    });

    if (track) {
      /*** Set up remote tracking branch ***/
      const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });

      await config.set(`branch.${ref}.remote`, remote);
      await config.set(`branch.${ref}.merge`, `refs/heads/${ref}`);
      await GitConfigManager.save({ config, fs: unifiedFs, gitdir });
    }

    /*** Create a new branch that points at that same commit ***/
    await GitRefManager.writeRef({
      fs: unifiedFs,
      gitdir,
      ref: `refs/heads/${ref}`,
      value: oid
    });
  }

  /*** Update working dir ***/
  if (!noCheckout) {
    let ops: Array<[string, string, unknown?, unknown?]>;

    /*** First pass - just analyze files (not directories) and figure out what needs to be done ***/
    try {
      ops = await analyze({
        cache,
        dir,
        ...(filepaths !== undefined ? { filepaths } : {}),
        fs,
        gitdir,
        ref
      });
    } catch(err) {
      /*** Throw a more helpful error message for this common mistake. ***/
      if (err instanceof NotFoundError && err.data.what === oid)
        throw new CommitNotFetchedError(ref, oid);
      else
        throw err;
    }

    /*** Report conflicts ***/
    const conflicts = ops
      .filter(([method]) => method === "conflict")
      .map(([_method, fullpath]) => fullpath);

    if (conflicts.length > 0)
      throw new CheckoutConflictError(conflicts);

    /*** Collect errors ***/
    const errors = ops
      .filter(([method]) => method === "error")
      .map(([_method, fullpath]) => fullpath);

    if (errors.length > 0)
      throw new InternalError(errors.join(", "));

    if (dryRun) {
      if (onPostCheckout) {
        await onPostCheckout({
          newHead: oid,
          previousHead: oldOid!,
          type: filepaths !== null && filepaths !== undefined && filepaths.length > 0 ?
            "file" :
            "branch"
        });
      }

      return;
    }

    /*** Second pass - execute planned changes ***/
    const total = ops.length;
    let count = 0;

    await GitIndexManager.acquire(
      { cache, fs: unifiedFs, gitdir },
      async function (index) {
        /*** Delete files and update index ***/
        await Promise.all(
          ops
            .filter(([method]) => method === "delete" || method === "delete-index")
            .map(async([_method, fullpath]) => {
              const filepath = `${dir}/${fullpath}`;

              if (_method === "delete")
                await fs.unlink(filepath);

              index.delete({ filepath: fullpath });

              if (onProgress) {
                await onProgress({
                  lengthComputable: true,
                  loaded: ++count,
                  phase: "Updating files",
                  total
                });
              }
            })
        );

        /*** Create directories ***/
        await Promise.all(
          ops
            .filter(([method]) => method === "mkdir")
            .map(async([_method, fullpath]) => {
              const filepath = `${dir}/${fullpath}`;
              await fs.mkdir(filepath);

              if (onProgress) {
                await onProgress({
                  lengthComputable: true,
                  loaded: ++count,
                  phase: "Updating files",
                  total
                });
              }
            })
        );

        /*** Write files and update index ***/
        const writeOps = ops.filter(([method]) => method === "create" || method === "update");

        if (nonBlocking) {
          await batchAllSettled("write", writeOps, onProgress, batchSize);
        } else {
          await Promise.all(
            writeOps.map(async([_method, fullpath, oid, _mode]) => {
              await updateWorkingDir({
                cache,
                dir,
                fs,
                fullpath,
                gitdir,
                index,
                oid: oid as string
              });

              if (onProgress) {
                await onProgress({
                  lengthComputable: true,
                  loaded: ++count,
                  phase: "Updating files",
                  total
                });
              }
            })
          );
        }
      }
    );
  }

  /*** Update HEAD ***/
  if (!noUpdateHead) {
    const fullRef = await GitRefManager.expand({ fs: unifiedFs, gitdir, ref });

    if (fullRef !== ref) {
      /*** Update HEAD to point at the new branch ***/
      await GitRefManager.writeSymbolicRef({
        fs: unifiedFs,
        gitdir,
        ref: "HEAD",
        value: fullRef
      });
    } else {
      /*** Update HEAD to point at the oid (detached head) ***/
      await GitRefManager.writeRef({ fs: unifiedFs, gitdir, ref: "HEAD", value: oid });
    }
  }

  if (onPostCheckout) {
    await onPostCheckout({
      newHead: oid,
      previousHead: oldOid!,
      type: filepaths !== null && filepaths !== undefined && filepaths.length > 0 ?
        "file" :
        "branch"
    });
  }
}



//// helper

/*** Helper functions for checkout operation ***/
async function analyze({
  cache,
  dir,
  filepaths,
  fs,
  gitdir,
  ref
}: {
  cache: Cache;
  dir: string;
  filepaths?: string[];
  fs: FsInterface;
  gitdir: string;
  ref: string;
}): Promise<Array<[string, string, unknown?, unknown?]>> {
  const unifiedFs = adaptFsInterface(fs);

  // Enhanced analyze function with comprehensive checkout logic
  const ops: Array<[string, string, unknown?, unknown?]> = [];
  const conflicts: string[] = [];

  // Get the tree for the target ref
  const oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref });
  await readObject({ cache, fs, gitdir, oid });

  // Walk the tree and determine what operations are needed
  await _walk({
    cache,
    dir,
    fs,
    gitdir,
    map: async(fullpath: string, [A, B, C]: (WalkerEntry | null)[]) => {
      if (filepaths && !filepaths.some((base) => worthWalking(fullpath, base)))
        return null;

      // Get file information for all three trees: target, workdir, stage
      const targetOid = A ? await A.oid() : undefined;
      const workdirOid = B ? await B.oid() : undefined;
      const stageOid = C ? await C.oid() : undefined;

      const targetMode = A ? await A.mode() : undefined;
      // const workdirMode = B ? await B.mode() : undefined;
      // const stageMode = C ? await C.mode() : undefined;

      const targetType = A ? await A.type() : undefined;
      const workdirType = B ? await B.type() : undefined;
      const stageType = C ? await C.type() : undefined;

      // Skip if dealing with directories/special files (focus on blobs)
      if (targetType === "tree" || workdirType === "tree" || stageType === "tree") {
        return undefined;
      }

      // Enhanced operation determination
      if (targetOid && !workdirOid && !stageOid) {
        // File exists in target but nowhere else - create it
        ops.push(["create", fullpath, targetOid, targetMode]);
      }
      else if (!targetOid && workdirOid && !stageOid) {
        // File exists in workdir only - remove it (clean checkout)
        ops.push(["delete", fullpath]);
      }
      else if (!targetOid && !workdirOid && stageOid) {
        // File exists in stage only - remove it from stage
        ops.push(["rmstage", fullpath]);
      }
      else if (targetOid && workdirOid && !stageOid) {
        if (targetOid !== workdirOid) {
          // File modified in workdir, need to update to target
          ops.push(["update", fullpath, targetOid, targetMode]);
        }
      }
      else if (targetOid && !workdirOid && stageOid) {
        if (targetOid !== stageOid) {
          // File staged but different from target - potential conflict
          conflicts.push(fullpath);
          ops.push(["conflict", fullpath, targetOid, targetMode]);
        } else {
          // File staged and matches target - create workdir version
          ops.push(["create", fullpath, targetOid, targetMode]);
        }
      }
      else if (targetOid && workdirOid && stageOid) {
        const allSame = targetOid === workdirOid && workdirOid === stageOid;

        if (!allSame) {
          if (targetOid === stageOid && targetOid !== workdirOid) {
            // Workdir modified - update to target
            ops.push(["update", fullpath, targetOid, targetMode]);
          } else if (targetOid !== stageOid) {
            // Both staged and target different - potential conflict
            conflicts.push(fullpath);
            ops.push(["conflict", fullpath, targetOid, targetMode]);
          }
        }
        // If all same, no operation needed
      }

      return undefined;
    },
    trees: [TREE({ ref }), WORKDIR(), STAGE()]
  });

  // Log conflicts for user awareness
  if (conflicts.length > 0) {
    console.warn(`Potential conflicts detected in: ${conflicts.join(", ")}`);
  }

  return ops;
}

async function batchAllSettled(
  operationName: string,
  tasks: Array<[string, string, unknown?, unknown?]>,
  onProgress?: ProgressCallback,
  batchSize: number = 100
): Promise<void> {
  const total = tasks.length;
  let count = 0;

  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(async(_task) => {
        /*** Process task ***/
        count++;

        if (onProgress) {
          await onProgress({
            lengthComputable: true,
            loaded: count,
            phase: operationName,
            total
          });
        }
      })
    );
  }
}

function updateIndex({
  fullpath,
  index,
  oid,
  stats
}: {
  fullpath: string;
  index: unknown;
  oid: string;
  stats: unknown;
}): void {
  (index as any).insert({ filepath: fullpath, oid, stats });
}

async function updateWorkingDir({
  cache,
  dir,
  fs,
  fullpath,
  gitdir,
  index,
  oid
}: {
  cache: Cache;
  dir: string;
  fs: FsInterface;
  fullpath: string;
  gitdir: string;
  index: unknown;
  oid: string;
}): Promise<void> {
  const filepath = `${dir}/${fullpath}`;
  const { object } = await readObject({ cache, fs, gitdir, oid });

  /*** Write the file content ***/
  await fs.writeFile(filepath, object);

  /*** Update the index ***/
  const stats = await fs.lstat(filepath);
  await updateIndex({ fullpath, index, oid, stats });
}

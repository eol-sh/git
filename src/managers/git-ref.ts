/**
 * @fileoverview git-ref manager
 *
 * Manages git-ref resources including creation, access, and lifecycle.
 * Provides centralized control and caching for git-ref operations.
 *
 * @module managers/git-ref.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import AsyncLock from "../compat/async-lock.ts";

import { compareRefNames } from "../utils/compare-ref-names.ts";
import { GitConfigManager } from "./git-config.ts";
import { GitPackedRefs } from "../models/git-packed-refs.ts";
import { GitRefSpecSet } from "../models/git-ref-spec-set.ts";
import { InvalidOidError } from "../errors/invalid-oid.ts";
import { join } from "../utils/join.ts";
import { NoRefspecError } from "../errors/no-refspec.ts";
import { NotFoundError } from "../errors/not-found.ts";

interface FileSystemLike {
  exists(filepath: string): Promise<boolean>;
  lstat(filepath: string): Promise<unknown>;
  read(filepath: string, options?: { encoding?: string }): Promise<string>;
  readdirDeep(dirpath: string): Promise<string[]>;
  rm(filepath: string): Promise<void>;
  write(filepath: string, contents: string, encoding?: string): Promise<void>;
}

/*** @see https://git-scm.com/docs/git-rev-parse.html#_specifying_revisions ***/
const refpaths = (ref: string): string[] => [
  `${ref}`,
  `refs/${ref}`,
  `refs/tags/${ref}`,
  `refs/heads/${ref}`,
  `refs/remotes/${ref}`,
  `refs/remotes/${ref}/HEAD`,
];

/*** @see https://git-scm.com/docs/gitrepository-layout ***/
const GIT_FILES = ["config", "description", "index", "shallow", "commondir"];

let lock: AsyncLock | undefined;



//// export

export interface DeleteRefOptions {
  fs: FileSystemLike;
  gitdir: string;
  ref: string;
}

export interface DeleteRefsOptions {
  fs: FileSystemLike;
  gitdir: string;
  refs: string[];
}

export interface RefManagerBaseOptions {
  fs: FileSystemLike;
  gitdir: string;
}

export interface ResolveAgainstMapOptions {
  depth?: number;
  fullref?: string;
  map: Map<string, string>;
  ref: string;
}

export interface ResolveRefOptions {
  depth?: number;
  fs: FileSystemLike;
  gitdir: string;
  ref: string;
}

export interface ResolveResult {
  fullref: string;
  oid: string;
}

export interface UpdateRemoteRefsOptions {
  fs: FileSystemLike;
  gitdir: string;
  prune?: boolean;
  pruneTags?: boolean;
  remote: string;
  refs: Map<string, string>;
  refspecs?: string[];
  symrefs: Map<string, string>;
  tags: boolean;
}

export interface UpdateRemoteRefsResult {
  pruned: string[];
}

export interface WriteRefOptions {
  fs: FileSystemLike;
  gitdir: string;
  ref: string;
  value: string;
  force?: boolean;
  symbolic?: boolean;
}

export interface WriteSymbolicRefOptions {
  fs: FileSystemLike;
  gitdir: string;
  ref: string;
  value: string;
}



export interface ExpandAgainstMapOptions {
  ref: string;
  map: Map<string, string>;
}

export interface ExpandRefOptions extends RefManagerBaseOptions {
  ref: string;
}

export interface ExistsRefOptions extends RefManagerBaseOptions {
  ref: string;
}

export interface ListBranchesOptions extends RefManagerBaseOptions {
  remote?: string;
}

export interface ListRefsOptions extends RefManagerBaseOptions {
  filepath: string;
}



export class GitRefManager {
  static async updateRemoteRefs({
    fs,
    gitdir,
    prune = false,
    pruneTags = false,
    refs,
    refspecs = undefined,
    remote,
    symrefs,
    tags
  }: UpdateRemoteRefsOptions): Promise<UpdateRemoteRefsResult> {
    /*** Validate input ***/
    for (const value of refs.values()) {
      if (!value.match(/[0-9a-f]{40}/))
        throw new InvalidOidError(value);
    }

    const config = await GitConfigManager.get({ fs: fs as any, gitdir });

    if (!refspecs) {
      refspecs = (await config.getall(`remote.${remote}.fetch`)) as string[];

      if (refspecs && refspecs.length === 0)
        throw new NoRefspecError(remote);

      /*** There’s some interesting behavior with HEAD that doesn’t follow the refspec. ***/
      refspecs?.unshift(`+HEAD:refs/remotes/${remote}/HEAD`);
    }

    const refspec = GitRefSpecSet.from(refspecs || []);
    const actualRefsToWrite = new Map<string, string>();

    /*** Delete all current tags if the pruneTags argument is true. ***/
    if (pruneTags) {
      const tags = await GitRefManager.listRefs({
        filepath: "refs/tags",
        fs,
        gitdir
      });

      await GitRefManager.deleteRefs({
        fs,
        gitdir,
        refs: tags.map((tag) => `refs/tags/${tag}`)
      });
    }

    /*** Add all tags if the fetch tags argument is true. ***/
    if (tags) {
      for (const serverRef of refs.keys()) {
        if (serverRef.startsWith("refs/tags") && !serverRef.endsWith("^{}")) {
          /*** Git’s behavior is to only fetch tags that do not conflict with tags already present. ***/
          if (!(await GitRefManager.exists({ fs, gitdir, ref: serverRef }))) {
            /*** Always use the object id of the tag itself, and not the peeled object id. ***/
            const oid = refs.get(serverRef)!;
            actualRefsToWrite.set(serverRef, oid);
          }
        }
      }
    }

    /*** Combine refs and symrefs giving symrefs priority ***/
    const refTranslations = refspec.translate([...refs.keys()]);

    for (const [serverRef, translatedRef] of refTranslations) {
      const value = refs.get(serverRef)!;
      actualRefsToWrite.set(translatedRef, value);
    }

    const symrefTranslations = refspec.translate([...symrefs.keys()]);

    for (const [serverRef, translatedRef] of symrefTranslations) {
      const value = symrefs.get(serverRef)!;
      const symtarget = refspec.translateOne(value);

      if (symtarget)
        actualRefsToWrite.set(translatedRef, `ref: ${symtarget}`);
    }

    /*** If `prune` argument is true, clear out the existing local refspec roots ***/
    const pruned: string[] = [];

    if (prune) {
      for (const filepath of refspec.localNamespaces()) {
        const refs = (
          await GitRefManager.listRefs({
            filepath,
            fs,
            gitdir
          })
        ).map((file) => `${filepath}/${file}`);

        for (const ref of refs) {
          if (!actualRefsToWrite.has(ref))
            pruned.push(ref);
        }
      }

      if (pruned.length > 0)
        await GitRefManager.deleteRefs({ fs, gitdir, refs: pruned });
    }

    /*** Update files - use packed-refs for efficiency with large numbers of refs ***/
    const shouldUsePackedRefs = actualRefsToWrite.size > 100; /*** Threshold for using packed-refs ***/

    if (shouldUsePackedRefs) {
      /*** For large repos, write to packed-refs for efficiency ***/
      try {
        await GitRefManager._updatePackedRefs(fs, gitdir, actualRefsToWrite, remote);
      } catch(error) {
        console.warn(`Failed to update packed-refs, falling back to loose refs: ${String(error)}`);

        /*** Fall back to writing individual ref files ***/
        await GitRefManager._writeLooseRefs(fs, gitdir, actualRefsToWrite);
      }
    } else {
      /*** For smaller updates, write individual ref files ***/
      await GitRefManager._writeLooseRefs(fs, gitdir, actualRefsToWrite);
    }

    return { pruned };
  }

  /**
   * Write refs to packed-refs file for efficiency
   */
  private static async _updatePackedRefs(fs: FileSystemLike, gitdir: string, refsToWrite: Map<string, string>, remote?: string): Promise<void> {
    /*** Load existing packed-refs ***/
    const packedRefsPath = join(gitdir, "packed-refs");
    let packedRefs = new GitPackedRefs();

    try {
      const packedRefsFile = await fs.read(packedRefsPath, { encoding: "utf8" });
      packedRefs = GitPackedRefs.from(packedRefsFile);
    } catch {
      /*** File doesn’t exist, start with empty packed-refs ***/
    }

    /*** Add/update the new refs ***/
    for (const [ref, oid] of refsToWrite) {
      (packedRefs as any).set(ref, oid);
    }

    /*** Write back to packed-refs file ***/
    await acquireLock("packed-refs", async() => {
      await fs.write(packedRefsPath, packedRefs.toString());
    });

    /*** Clean up loose ref files that are now in packed-refs (optional optimization) ***/
    if (remote) {
      try {
        /*** Only remove refs we just wrote to avoid conflicts ***/
        for (const ref of refsToWrite.keys()) {
          if (ref.startsWith(`refs/remotes/${remote}/`)) {
            const loosePath = join(gitdir, ref);

            try {
              await fs.rm(loosePath);
            } catch {
              /*** Ignore errors removing loose files ***/
            }
          }
        }
      } catch {
        /*** Ignore cleanup errors ***/
      }
    }
  }

  /**
   * Write refs as individual loose ref files
   */
  private static async _writeLooseRefs(fs: FileSystemLike, gitdir: string, refsToWrite: Map<string, string>): Promise<void> {
    for (const [key, value] of refsToWrite) {
      await acquireLock(
        key,
        () => fs.write(join(gitdir, key), `${value.trim()}\n`, "utf8")
      );
    }
  }

  static deleteRef({ fs, gitdir, ref }: DeleteRefOptions): Promise<void> {
    return GitRefManager.deleteRefs({ fs, gitdir, refs: [ref] });
  }

  static async deleteRefs({ fs, gitdir, refs }: DeleteRefsOptions): Promise<void> {
    /*** Delete regular ref ***/
    await Promise.all(refs.map((ref) => fs.rm(join(gitdir, ref))));

    /*** Delete any packed ref ***/
    let text = await acquireLock(
      "packed-refs",
      () => fs.read(`${gitdir}/packed-refs`, { encoding: "utf8" })
    );

    const packed = GitPackedRefs.from(text);
    const beforeSize = packed.refs.size;

    for (const ref of refs) {
      if (packed.refs.has(ref))
        packed.delete(ref);
    }

    if (packed.refs.size < beforeSize) {
      text = packed.toString();

      await acquireLock(
        "packed-refs",
        () => fs.write(`${gitdir}/packed-refs`, text)
      );
    }
  }

  static async exists({ fs, gitdir, ref }: ExistsRefOptions): Promise<boolean> {
    try {
      await GitRefManager.expand({ fs, gitdir, ref });
      return true;
    } catch {
      return false;
    }
  }

  static async expand({ fs, gitdir, ref }: ExpandRefOptions): Promise<string> {
    /*** Is it a complete and valid SHA? ***/
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref))
      return ref;

    /*** We need to alternate between the file system and the packed-refs ***/
    const packedMap = await GitRefManager.packedRefs({ fs, gitdir });

    /*** Look in all the proper paths, in this order ***/
    const allpaths = refpaths(ref);

    for (const ref of allpaths) {
      const refExists = await acquireLock(
        ref,
        () => fs.exists(`${gitdir}/${ref}`)
      );

      if (refExists)
        return ref;

      if (packedMap.has(ref))
        return ref;
    }

    /*** Do we give up? ***/
    throw new NotFoundError(ref);
  }

  static expandAgainstMap({ ref, map }: ExpandAgainstMapOptions): string {
    /*** Look in all the proper paths, in this order ***/
    const allpaths = refpaths(ref);

    for (const ref of allpaths) {
      if (map.has(ref))
        return ref;
    }

    /*** Do we give up? ***/
    throw new NotFoundError(ref);
  }

  static listBranches({ fs, gitdir, remote }: ListBranchesOptions): Promise<string[]> {
    if (remote)
      return GitRefManager.listRefs({ filepath: `refs/remotes/${remote}`, fs, gitdir });
    else
      return GitRefManager.listRefs({ filepath: `refs/heads`, fs, gitdir });
  }

  /*** List all the refs that match the `filepath` prefix ***/
  static async listRefs({ filepath, fs, gitdir }: ListRefsOptions): Promise<string[]> {
    const packedMap = GitRefManager.packedRefs({ fs, gitdir });
    let files: string[] = [];

    try {
      files = await fs.readdirDeep(`${gitdir}/${filepath}`);
      files = files.map((x) => x.replace(`${gitdir}/${filepath}/`, ""));
    } catch {
      files = [];
    }

    for (let key of (await packedMap).keys()) {
      /*** filter by prefix ***/
      if (key.startsWith(filepath)) {
        /*** remove prefix ***/
        key = key.replace(filepath + "/", "");

        /*** Don’t include duplicates; the loose files have precedence anyway ***/
        if (!files.includes(key))
          files.push(key);
      }
    }

    /*** since we just appended things onto an array, we need to sort them now ***/
    files.sort(compareRefNames);
    return files;
  }

  static async listTags({ fs, gitdir }: RefManagerBaseOptions): Promise<string[]> {
    const tags = await GitRefManager.listRefs({ filepath: `refs/tags`, fs, gitdir });
    return tags.filter((x) => !x.endsWith("^{}"));
  }

  static async packedRefs({ fs, gitdir }: RefManagerBaseOptions): Promise<Map<string, string>> {
    const text = await acquireLock(
      "packed-refs",
      () => fs.read(`${gitdir}/packed-refs`, { encoding: "utf8" })
    );

    const packed = GitPackedRefs.from(text);
    return packed.refs;
  }

  /**
   * @param options - Options for resolving a reference
   * @returns The resolved OID string
   */
  static async resolve({ depth = undefined, fs, gitdir, ref }: ResolveRefOptions): Promise<string> {
    if (depth !== undefined) {
      depth--;

      if (depth === -1)
        return ref;
    }

    /*** Is it a ref pointer? ***/
    if (ref.startsWith("ref: ")) {
      ref = ref.slice("ref: ".length);
      return GitRefManager.resolve({
        ...(depth !== undefined ? { depth } : {}),
        fs,
        gitdir,
        ref
      });
    }

    /*** Is it a complete and valid SHA? ***/
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref))
      return ref;

    /*** We need to alternate between the file system and the packed-refs ***/
    const packedMap = await GitRefManager.packedRefs({ fs, gitdir });

    /*** Look in all the proper paths, in this order ***/
    const allpaths = refpaths(ref).filter((p) => !GIT_FILES.includes(p)); /*** exclude git system files (#709) ***/

    for (const ref of allpaths) {
      const sha = await acquireLock(
        ref,
        async() =>
          (await fs.read(`${gitdir}/${ref}`, { encoding: "utf8" })) ||
          packedMap.get(ref)
      );

      if (sha)
        return GitRefManager.resolve({
          ...(depth !== undefined ? { depth } : {}),
          fs,
          gitdir,
          ref: sha.trim()
        });
    }

    /*** Do we give up? ***/
    throw new NotFoundError(ref);
  }

  static resolveAgainstMap({ depth = undefined, fullref, map, ref }: ResolveAgainstMapOptions): ResolveResult {
    if (!fullref)
      fullref = ref;

    if (depth !== undefined) {
      depth--;

      if (depth === -1)
        return { fullref, oid: ref };
    }

    /*** Is it a ref pointer? ***/
    if (ref.startsWith("ref: ")) {
      ref = ref.slice("ref: ".length);

      return GitRefManager.resolveAgainstMap({
        ...(depth !== undefined ? { depth } : {}),
        fullref,
        map,
        ref
      });
    }

    /*** Is it a complete and valid SHA? ***/
    if (ref.length === 40 && /[0-9a-f]{40}/.test(ref))
      return { fullref, oid: ref };

    /*** Look in all the proper paths, in this order ***/
    const allpaths = refpaths(ref);

    for (const ref of allpaths) {
      const sha = map.get(ref);

      if (sha) {
        return GitRefManager.resolveAgainstMap({
          ...(depth !== undefined ? { depth } : {}),
          fullref: ref,
          map,
          ref: sha.trim()
        });
      }
    }

    /*** Do we give up? ***/
    throw new NotFoundError(ref);
  }

  /**
   * Write a reference to point to a specific commit OID
   */
  static async writeRef({ fs, gitdir, ref, value }: WriteRefOptions): Promise<void> {
    /*** Validate OID format - must be exactly 40 hex characters ***/
    const trimmedValue = value.trim();

    if (!/^[0-9a-f]{40}$/i.test(trimmedValue))
      throw new InvalidOidError(value);

    /*** Ensure the ref path is safe and valid ***/
    if (ref.includes("..") || ref.startsWith("/"))
      throw new Error(`Invalid ref name: ${ref}`);

    await acquireLock(
      ref,
      () => fs.write(join(gitdir, ref), `${trimmedValue}\n`, "utf8")
    );
  }

  static async writeSymbolicRef({ fs, gitdir, ref, value }: WriteSymbolicRefOptions): Promise<void> {
    await acquireLock(
      ref,
      () => fs.write(join(gitdir, ref), "ref: " + `${value.trim()}\n`, "utf8")
    );
  }
}



//// helper

function acquireLock<T>(ref: string, callback: () => Promise<T>): Promise<T> {
  if (lock === undefined)
    lock = new AsyncLock();

  return lock.acquire(ref, callback);
}

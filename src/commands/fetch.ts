


/**
 * @fileoverview Command for fetching objects and refs from remote repositories
 * 
 * This module implements Git's fetch operation, which downloads objects and references
 * from remote repositories. The command handles protocol negotiation, capability
 * discovery, packfile transfer, validation, and local reference updates. It supports
 * various fetch modes including shallow clones, single branch fetches, tag handling,
 * and pruning of stale references. The implementation includes comprehensive error
 * handling, progress reporting, and authentication support.
 * 
 * @module commands/fetch
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

//// util

import { _currentBranch } from "./current-branch.ts";
import { abbreviateRef } from "../utils/abbreviate-ref.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { collect } from "../utils/collect.ts";
import { emptyPackfile } from "../utils/empty-packfile.ts";
// import { validatePackfileStream } from "../utils/validate-packfile-stream.ts";
import { saveStreamToFile } from "../utils/save-stream-to-file.ts";
import { filterCapabilities } from "../utils/filter-capabilities.ts";
import { GitCommit } from "../models/git-commit.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import { GitPackIndex } from "../models/git-pack-index.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitRemoteManager } from "../managers/git-remote.ts";
import { GitShallowManager } from "../managers/git-shallow.ts";
import { hasObject } from "../storage/has-object.ts";
import { join } from "../utils/join.ts";
import { InternalError } from "../errors/internal.ts";
import { MissingParameterError } from "../errors/missing-parameter.ts";
import { parseUploadPackResponse } from "../wire/parse-upload-pack-response.ts";
import { pkg } from "../utils/pkg.ts";
import { _readObject as readObject } from "../storage/read-object.ts";
import { RemoteCapabilityError } from "../errors/remote-capability.ts";
import { splitLines } from "../utils/split-lines.ts";
import { writeUploadPackRequest } from "../wire/write-upload-pack-request.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
  Cache,
  FetchResult,
  FsInterface,
  HttpClient,
  MessageCallback,
  ProgressCallback
} from "../types.ts";

interface FetchOptions {
  cache: Cache;
  corsProxy?: string;
  depth?: number;
  exclude?: string[];
  fs: FsInterface;
  gitdir: string;
  headers?: Record<string, string>;
  http: HttpClient;
  onAuth?: AuthCallback;
  onAuthFailure?: AuthFailureCallback;
  onAuthSuccess?: AuthSuccessCallback;
  onMessage?: MessageCallback;
  onProgress?: ProgressCallback;
  prune?: boolean;
  pruneTags?: boolean;
  ref?: string;
  relative?: boolean;
  remote?: string;
  remoteRef?: string;
  since?: Date;
  singleBranch?: boolean;
  tags?: boolean;
  url?: string;
}



//// export

export async function _fetch({
  cache,
  corsProxy,
  depth,
  exclude = [],
  fs,
  gitdir,
  headers = {},
  http,
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  onMessage,
  onProgress,
  prune = false,
  pruneTags = false,
  ref: _ref,
  relative = false,
  remote: _remote,
  remoteRef: _remoteRef,
  since,
  singleBranch = false,
  tags = false,
  url: _url
}: FetchOptions): Promise<FetchResult> {
  const unifiedFs = adaptFsInterface(fs);
  const ref = _ref || (await _currentBranch({ fs, gitdir, test: true }));
  const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });

  /*** Figure out what remote to use. ***/
  const remote = _remote ||
    (ref && (await config.get(`branch.${ref}.remote`) as string)) ||
    "origin";

  /*** Lookup the URL for the given remote. ***/
  const url = _url || (await config.get(`remote.${remote}.url`) as string);

  if (typeof url === "undefined" || url === null || (typeof url === "object" && Object.keys(url).length === 0))
    throw new MissingParameterError("remote OR url");

  /*** Figure out what remote ref to use. ***/
  const remoteRef = _remoteRef ||
    (ref && (await config.get(`branch.${ref}.merge`))) ||
    _ref ||
    "HEAD";

  if (corsProxy === undefined)
    corsProxy = (await config.get("http.corsProxy")) as string | undefined;

  const GitRemoteHTTP = GitRemoteManager.getRemoteHelperFor({ url: url as string });

  const remoteHTTP = await GitRemoteHTTP.discover({
    ...(corsProxy !== undefined ? { corsProxy } : {}),
    headers,
    http,
    ...(onAuth !== undefined ? { onAuth } : {}),
    ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
    ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
    protocolVersion: 1,
    service: "git-upload-pack",
    url: url as string
  });

  const auth = remoteHTTP.auth; /*** hack to get new credentials from CredentialManager API ***/
  const remoteRefs = remoteHTTP.refs;

  /*** For the special case of an empty repository with no refs, return null. ***/
  if (!remoteRefs || remoteRefs.size === 0) {
    return {
      defaultBranch: null,
      fetchHead: null,
      fetchHeadDescription: null
    };
  }

  /*** Check that the remote supports the requested features ***/
  if (
    depth !== null && depth !== undefined &&
    !(remoteHTTP.capabilities?.includes("shallow"))
  ) throw new RemoteCapabilityError("shallow", "depth");

  if (
    since !== null && since !== undefined &&
    !(remoteHTTP.capabilities?.includes("deepen-since"))
  ) throw new RemoteCapabilityError("deepen-since", "since");

  if (exclude.length > 0 && !(remoteHTTP.capabilities?.includes("deepen-not")))
    throw new RemoteCapabilityError("deepen-not", "exclude");

  if (relative === true && !(remoteHTTP.capabilities?.includes("deepen-relative")))
    throw new RemoteCapabilityError("deepen-relative", "relative");

  /*** Figure out the SHA for the requested ref ***/
  const { fullref, oid } = GitRefManager.resolveAgainstMap({
    map: remoteRefs!,
    ref: remoteRef as string
  });

  /*** Filter out refs we want to ignore: only keep ref we’re cloning, HEAD, branches, and tags (if we’re keeping them) ***/
  for (const remoteRef of remoteRefs.keys()) {
    if (
      remoteRef === fullref ||
      remoteRef === "HEAD" ||
      remoteRef.startsWith("refs/heads/") ||
      (tags && remoteRef.startsWith("refs/tags/"))
    ) continue;

    remoteRefs.delete(remoteRef);
  }

  /*** Assemble the application/x-git-upload-pack-request ***/
  const capabilities = filterCapabilities(
    [...(remoteHTTP.capabilities || [])],
    [
      "multi_ack_detailed",
      "no-done",
      "side-band-64k",
      // Note: I removed "thin-pack" option since our code doesn’t "fatten" packfiles,
      // which is necessary for compatibility with git. It was the cause of mysterious
      // "fatal: pack has [x] unresolved deltas" errors that plagued us for some time.
      // @eol/git is perfectly happy with thin packfiles in .git/objects/pack but
      // canonical git it turns out is NOT.
      "ofs-delta",
      `agent=${pkg.agent}`,
    ],
  );

  if (relative)
    capabilities.push("deepen-relative");

  /*** Start figuring out which oids from the remote we want to request ***/
  const wants = singleBranch ?
    [oid] :
    [...remoteRefs!.values()];

  /*** Come up with a reasonable list of oids to tell the remote we already have
  (preferably oids that are close ancestors of the branch heads we’re fetching) ***/
  const haveRefs = singleBranch ?
    [ref] :
    await GitRefManager.listRefs({
      filepath: `refs`,
      fs: unifiedFs,
      gitdir
    });

  let haves: string[] = [];

  for (const ref of haveRefs) {
    try {
      const expandedRef = await GitRefManager.expand({ fs: unifiedFs, gitdir, ref: ref as string }) || ref;
      const oid = await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: expandedRef as string });

      if (await hasObject({ cache, fs, gitdir, oid }))
        haves.push(oid);
    } catch {
      /*** ignore missing refs ***/
    }
  }

  haves = [...new Set(haves)];

  const oids = await GitShallowManager.read({ fs, gitdir });
  const shallows = remoteHTTP.capabilities?.includes("shallow") ? [...oids] : [];

  const packstream = writeUploadPackRequest({
    capabilities,
    ...(depth !== undefined ? { depth } : {}),
    ...(exclude !== undefined ? { exclude } : {}),
    haves,
    shallows,
    ...(since !== undefined ? { since } : {}),
    wants
  });

  /*** CodeCommit will hang up if we don’t send a Content-Length header
  so we can’t stream the body. ***/
  const packbuffer = new Uint8Array(await collect(packstream as unknown as AsyncIterable<Uint8Array>));

  const raw = await GitRemoteHTTP.connect({
    auth: auth || {},
    body: [packbuffer],
    ...(corsProxy !== undefined ? { corsProxy } : {}),
    headers,
    http,
    ...(onProgress !== undefined ? { onProgress } : {}),
    service: "git-upload-pack",
    url: url as string
  });

  const response = await parseUploadPackResponse(raw.body);

  if (raw.headers)
    (response as any).headers = raw.headers;

  /*** Apply all the "shallow" and "unshallow" commands ***/
  for (const oid of response.shallows) {
    if (!oids.has(oid)) {
      /*** this is in a try/catch mostly because my old test fixtures are missing objects ***/
      try {
        /*** server says it’s shallow, but do we have the parents? ***/
        const { object } = await readObject({ cache, fs, gitdir, oid });
        const commit = new GitCommit(object);

        const hasParents = await Promise.all(
          commit
            .headers()
            .parent.map((oid: string) => hasObject({ fs, cache, gitdir, oid })),
        );

        const haveAllParents = hasParents.length === 0 ||
          hasParents.every((has) => has);

        if (!haveAllParents)
          oids.add(oid);
      } catch {
        oids.add(oid);
      }
    }
  }

  for (const oid of response.unshallows) {
    oids.delete(oid);
  }

  await GitShallowManager.write({ fs, gitdir, oids });

  /*** Update local remote refs ***/
  if (singleBranch) {
    const refs = new Map([[fullref, oid]]);
    /*** But wait, maybe it was a symref, like "HEAD"!
    We need to save all the refs in the symref chain (sigh). ***/
    const symrefs = new Map<string, string>();
    let bail = 10;
    let key = fullref;

    while (bail--) {
      const value = remoteHTTP.symrefs?.get(key);

      if (value === undefined)
        break;

      symrefs.set(key, value);
      key = value;
    }

    /*** final value must not be a symref but a real ref ***/
    const realRef = remoteRefs.get(key);

    /*** There may be no ref at all if we’ve fetched a specific commit hash ***/
    if (realRef)
      refs.set(key, realRef);

    const { pruned } = await GitRefManager.updateRemoteRefs({
      fs: unifiedFs,
      gitdir,
      prune,
      refs,
      remote,
      symrefs,
      tags
    });

    if (prune)
      (response as any).pruned = pruned;
  } else {
    const { pruned } = await GitRefManager.updateRemoteRefs({
      fs: unifiedFs,
      gitdir,
      prune,
      pruneTags,
      refs: remoteRefs!,
      remote,
      symrefs: remoteHTTP.symrefs!,
      tags
    });

    if (prune)
      (response as any).pruned = pruned;
  }

  /*** We need this value later for the `clone` command. ***/
  (response as any).HEAD = remoteHTTP.symrefs?.get("HEAD");

  /*** AWS CodeCommit doesn’t list HEAD as a symref, but we can reverse engineer it
  Find the SHA of the branch called HEAD ***/
  if ((response as any).HEAD === undefined) {
    const { oid } = GitRefManager.resolveAgainstMap({
      map: remoteRefs!,
      ref: "HEAD"
    });

    /*** Use the name of the first branch that’s not called HEAD that has
    the same SHA as the branch called HEAD. ***/
    for (const [key, value] of remoteRefs!.entries()) {
      if (key !== "HEAD" && value === oid) {
        (response as any).HEAD = key;
        break;
      }
    }
  }

  const noun = fullref.startsWith("refs/tags") ?
    "tag" :
    "branch";

  (response as any).FETCH_HEAD = {
    description: `${noun} "${abbreviateRef(fullref)}" of ${url}`,
    oid
  };

  if (onProgress || onMessage) {
    const lines = splitLines(response.progress as any) as any;

    for await (const line of lines) {
      if (onMessage)
        await onMessage(line);

      if (onProgress) {
        const matches = line.match(/([^:]*).*\((\d+?)\/(\d+?)\)/);

        if (matches) {
          await onProgress({
            lengthComputable: true,
            loaded: parseInt(matches[2], 10),
            phase: matches[1].trim(),
            total: parseInt(matches[3], 10)
          });
        }
      }
    }
  }

  // Enhanced packfile validation with streaming support
  let packfile: Uint8Array;
  let packfileSha: string;

  if ((raw.body as any).error)
    throw (raw.body as any).error;

  // Check if we have a stream or need to collect it
  if (response.packfile && typeof (response.packfile as any).getReader === 'function') {
    // Direct stream-to-disk saving with validation
    const tempPath = join(gitdir, "objects/pack/temp-packfile");

    try {
      const saveResult = await saveStreamToFile(
        fs as any,
        response.packfile as any,
        tempPath,
        {
          computeSha1: false,
          validateTrailingSha: true // Validates SHA and returns it
        }
      );

      packfileSha = saveResult.sha1!;

      // Read back for compatibility with existing index creation code
      // Note: This still uses some memory but much less than before during download
      packfile = await fs.read(tempPath) as Uint8Array;

      // Clean up temp file
      await fs.rm(tempPath).catch(() => {});
    } catch (error) {
      // Clean up temp file on error
      await fs.rm(tempPath).catch(() => {});
      throw new InternalError(`Packfile stream processing failed: ${(error as Error).message}`);
    }
  } else {
    // Fallback to original method for non-stream responses
    packfile = new Uint8Array(await collect(response.packfile as any));

    if (packfile.length >= 20) {
      const expectedShaBytes = packfile.slice(-20);
      const expectedSha = Array.from(expectedShaBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // Validate packfile integrity
      const contentToHash = packfile.slice(0, -20);
      const hashBuffer = await crypto.subtle.digest("SHA-1", contentToHash);
      const computedShaBytes = new Uint8Array(hashBuffer);
      const computedSha = Array.from(computedShaBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      if (computedSha !== expectedSha) {
        throw new InternalError(`Packfile validation failed: SHA checksum mismatch. Expected: ${expectedSha}, got: ${computedSha}`);
      }

      packfileSha = expectedSha;
    } else {
      packfileSha = "";
    }
  }

  const res: FetchResult = {
    defaultBranch: (response as any).HEAD,
    fetchHead: (response as any).FETCH_HEAD.oid,
    fetchHeadDescription: (response as any).FETCH_HEAD.description
  };

  if ((response as any).headers)
    (res as any).headers = (response as any).headers;

  if (prune)
    (res as any).pruned = (response as any).pruned;

  // Save validated packfile to disk
  if (packfileSha !== "" && !emptyPackfile(packfile)) {
    (res as any).packfile = `objects/pack/pack-${packfileSha}.pack`;

    const fullpath = join(gitdir, (res as any).packfile);
    await fs.writeFile(fullpath, packfile);

    const getExternalRefDelta = async (oid: string) => {
      const result = await readObject({ cache, fs, gitdir, oid });
      return { ...result, type: result.type as any };
    };

    const idx = await GitPackIndex.fromPack({
      getExternalRefDelta,
      ...(onProgress ? { onProgress: onProgress as any } : {}),
      pack: packfile
    });

    await fs.writeFile(fullpath.replace(/\.pack$/, ".idx"), await idx.toBuffer());
  }

  return res;
}

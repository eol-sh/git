


//// util

import { _currentBranch } from "./current-branch.ts";
import { _findMergeBase } from "./find-merge-base.ts";
import { _isDescendent } from "./is-descendent.ts";
import { _pack } from "./pack.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { filterCapabilities } from "../utils/filter-capabilities.ts";
import { GitConfigManager } from "../managers/git-config.ts";
import { GitPushError } from "../errors/git-push.ts";
import { GitRefManager } from "../managers/git-ref.ts";
import { GitRefSpec } from "../models/git-ref-spec.ts";
import { GitRemoteManager } from "../managers/git-remote.ts";
import { GitSideBand } from "../models/git-side-band.ts";
import { listCommitsAndTags } from "./list-commits-and-tags.ts";
import { listObjects } from "./list-objects.ts";
import { MissingParameterError } from "../errors/missing-parameter.ts";
import { NotFoundError } from "../errors/not-found.ts";
import { parseReceivePackResponse } from "../wire/parse-receive-pack-response.ts";
import { pkg } from "../utils/pkg.ts";
import { PushRejectedError } from "../errors/push-rejected.ts";
import { splitLines } from "../utils/split-lines.ts";
import { writeReceivePackRequest } from "../wire/write-receive-pack-request.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
  Cache,
  FsInterface,
  HttpClient,
  MessageCallback,
  PrePushCallback,
  ProgressCallback,
  PushResult
} from "../types.ts";

interface PushOptions {
  cache: Cache;
  corsProxy?: string;
  delete?: boolean;
  force?: boolean;
  fs: FsInterface;
  gitdir: string;
  headers?: Record<string, string>;
  http: HttpClient;
  onAuth?: AuthCallback;
  onAuthFailure?: AuthFailureCallback;
  onAuthSuccess?: AuthSuccessCallback;
  onMessage?: MessageCallback;
  onPrePush?: PrePushCallback;
  onProgress?: ProgressCallback;
  ref?: string;
  remote?: string;
  remoteRef?: string;
  url?: string;
}



//// export

export async function _push({
  cache,
  corsProxy,
  delete: _delete = false,
  force = false,
  fs,
  gitdir,
  headers = {},
  http,
  onAuth,
  onAuthSuccess,
  onAuthFailure,
  onMessage,
  onPrePush,
  onProgress,
  ref: _ref,
  remote,
  remoteRef: _remoteRef,
  url: _url
}: PushOptions): Promise<PushResult> {
  const unifiedFs = adaptFsInterface(fs);
  const ref = _ref || (await _currentBranch({ fs, gitdir }));

  if (typeof ref === "undefined")
    throw new MissingParameterError("ref");

  const config = await GitConfigManager.get({ fs: unifiedFs, gitdir });

  /*** Figure out what remote to use. ***/
  remote = remote ||
    (await config.get(`branch.${ref}.pushRemote`) as string) ||
    (await config.get("remote.pushDefault") as string) ||
    (await config.get(`branch.${ref}.remote`) as string) ||
    "origin";

  /*** Lookup the URL for the given remote. ***/
  const url = _url ||
    (await config.get(`remote.${remote}.pushurl`) as string) ||
    (await config.get(`remote.${remote}.url`) as string);

  if (typeof url === "undefined" || url === null || (typeof url === "object" && Object.keys(url).length === 0))
    throw new MissingParameterError("remote OR url");

  /*** Figure out what remote ref to use. ***/
  const remoteRef = _remoteRef || (await config.get(`branch.${ref}.merge`) as string);

  if (typeof url === "undefined")
    throw new MissingParameterError("remoteRef");

  if (corsProxy === undefined)
    corsProxy = (await config.get("http.corsProxy") as string | undefined);

  const fullRef = await GitRefManager.expand({ fs: unifiedFs, gitdir, ref });

  const oid = _delete ?
    "0000000000000000000000000000000000000000" :
    await GitRefManager.resolve({ fs: unifiedFs, gitdir, ref: fullRef });

  const GitRemoteHTTP = GitRemoteManager.getRemoteHelperFor({ url: url as string });

  const httpRemote = await GitRemoteHTTP.discover({
    ...(corsProxy !== undefined ? { corsProxy } : {}),
    headers,
    http,
    ...(onAuth !== undefined ? { onAuth } : {}),
    ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
    ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
    protocolVersion: 1,
    service: "git-receive-pack",
    url
  });

  const auth = httpRemote.auth; /*** hack to get new credentials from CredentialManager API ***/
  let fullRemoteRef: string;

  if (!remoteRef) {
    fullRemoteRef = fullRef;
  } else {
    try {
      fullRemoteRef = await GitRefManager.expandAgainstMap({
        map: httpRemote.refs!,
        ref: remoteRef
      });
    } catch(err) {
      if (err instanceof NotFoundError) {
        /*** The remote reference doesn’t exist yet.
        If it is fully specified, use that value. Otherwise, treat it as a branch. ***/
        fullRemoteRef = (remoteRef as string).startsWith("refs/") ?
          remoteRef as string :
          `refs/heads/${remoteRef as string}`;
      } else {
        throw err;
      }
    }
  }

  const oldoid = httpRemote.refs?.get(fullRemoteRef) || "0000000000000000000000000000000000000000";

  if (onPrePush)
    await onPrePush(url as string, [fullRemoteRef]);

  /*** Remotes can always accept thin-packs UNLESS they specify the "no-thin" capability ***/
  const thinPack = !httpRemote.capabilities?.includes("no-thin");
  let objects = new Set<string>();

  if (!_delete) {
    const finish = [...(httpRemote.refs?.values() || [])];
    let skipObjects = new Set<string>();

    /*** If remote branch is present, look for a common merge base. ***/
    if (oldoid !== "0000000000000000000000000000000000000000") {
      /*** trick to speed up common force push scenarios ***/
      const mergebase = await _findMergeBase({
        cache,
        fs,
        gitdir,
        oids: [oid, oldoid]
      });

      for (const oid of mergebase) {
        finish.push(oid);
      }

      if (thinPack)
        skipObjects = await listObjects({ cache, fs, gitdir, oids: mergebase });
    }

    /*** If remote does not have the commit, figure out the objects to send ***/
    if (!finish.includes(oid)) {
      const commits = await listCommitsAndTags({
        cache,
        finish,
        fs,
        gitdir,
        start: [oid]
      });

      objects = await listObjects({
        cache,
        fs,
        gitdir,
        oids: commits
      });
    }

    if (thinPack) {
      /*** If there’s a default branch for the remote lets skip those objects too.
      Since this is an optional optimization, we just catch and continue if there is
      an error (because we can’t find a default branch, or can’t find a commit, etc) ***/
      try {
        /*** Sadly, the discovery phase with "forPush" doesn’t return symrefs, so we have to
        rely on existing ones. ***/
        const ref = await GitRefManager.resolve({
          depth: 2,
          fs: unifiedFs,
          gitdir,
          ref: `refs/remotes/${remote}/HEAD`
        });

        const { oid } = await GitRefManager.resolveAgainstMap({
          fullref: ref,
          map: httpRemote.refs!,
          ref: ref.replace(`refs/remotes/${remote}/`, "")
        });

        const oids = [oid];

        for (const oid of await listObjects({ cache, fs, gitdir, oids })) {
          skipObjects.add(oid);
        }
      } catch {
        /*** ignore errors in optimization ***/
      }

      /*** Remove objects that we know the remote already has ***/
      for (const oid of skipObjects) {
        objects.delete(oid);
      }
    }

    if (oid === oldoid)
      force = true;

    if (!force) {
      /*** Is it a tag that already exists? ***/
      if (fullRef.startsWith("refs/tags") && oldoid !== "0000000000000000000000000000000000000000")
        throw new PushRejectedError("tag-exists");

      /*** Is it a non-fast-forward commit? ***/
      if (
        oid !== "0000000000000000000000000000000000000000" &&
        oldoid !== "0000000000000000000000000000000000000000" &&
        !(await _isDescendent({
          ancestor: oldoid,
          cache,
          depth: -1,
          fs,
          gitdir,
          oid
        }))
      ) throw new PushRejectedError("not-fast-forward");
    }
  }

  /*** We can only safely use capabilities that the server also understands.
  For instance, AWS CodeCommit aborts a push if you include the `agent`!!! ***/
  const capabilities = filterCapabilities(
    [...(httpRemote.capabilities || [])],
    ["report-status", "side-band-64k", `agent=${pkg.agent}`]
  );

  const packstream1 = await writeReceivePackRequest({
    capabilities,
    triplets: [{ fullRef: fullRemoteRef, oid, oldoid }]
  });

  const packstream2 = _delete ? [] : await _pack({
    cache,
    fs,
    gitdir,
    oids: [...objects],
  });

  const res = await GitRemoteHTTP.connect({
    auth: auth || {},
    body: [...packstream1, ...packstream2],
    ...(corsProxy !== undefined ? { corsProxy } : {}),
    headers,
    http,
    ...(onProgress !== undefined ? { onProgress } : {}),
    service: "git-receive-pack",
    url
  });

  const { packfile, progress } = await GitSideBand.demux(res.body);

  if (onMessage) {
    const lines = splitLines(progress as any);

    for await (const line of lines as any) {
      await onMessage(line);
    }
  }

  /*** Parse the response! ***/
  const result = await parseReceivePackResponse(packfile);

  if (res.headers)
    (result as any).headers = res.headers;

  /*** Update the local copy of the remote ref ***/
  if (
    remote &&
    (result as any).ok &&
    (result as any).refs[fullRemoteRef].ok &&
    !fullRef.startsWith("refs/tags")
  ) {
    /*** Use proper refspec transformation for tracking branches ***/
    try {
      /*** Create a refspec for the pushed branch to update remote tracking branch ***/
      const trackingRefspec = GitRefSpec.from(
        `${fullRemoteRef}:refs/remotes/${remote}/${
          fullRemoteRef.replace(/^refs\/heads\//, "")
        }`,
        { isFetch: true }
      );

      const ref = trackingRefspec.localPath;

      if (ref) {
        if (_delete)
          await GitRefManager.deleteRef({ fs: unifiedFs, gitdir, ref });
        else
          await GitRefManager.writeRef({ fs: unifiedFs, gitdir, ref, value: oid });
      }
    } catch(error) {
      /*** If refspec parsing fails, fall back to simple approach ***/
      console.warn(`Failed to parse refspec for tracking branch: ${String(error)}`);
    }
  }

  if ((result as any).ok && Object.values((result as any).refs).every((result: any) => result.ok)) {
    return result;
  } else {
    const prettyDetails = Object.entries((result as any).refs)
      .filter(([_k, v]: [string, any]) => !v.ok)
      .map(([k, v]: [string, any]) => `\n  - ${k}: ${v.error}`)
      .join("");

    throw new GitPushError(prettyDetails, result);
  }
}

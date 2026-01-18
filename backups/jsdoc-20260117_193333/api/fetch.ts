


//// util

import { _fetch } from "../commands/fetch.ts";
import { adaptFileSystem } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { FileSystem } from "../models/file-system.ts";
import { join } from "../utils/join.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
  Cache,
  FetchResult,
  FsClient,
  HttpClient,
  MessageCallback,
  ProgressCallback,
} from "../types.ts";



//// export

/**
 * Options for the fetch operation
 */
export interface FetchOptions {
  /*** a [cache](cache.md) object ***/
  cache?: Cache;
  /*** Optional [CORS proxy](https://www.npmjs.com/%40isomorphic-git/cors-proxy). Overrides value in repo config. ***/
  corsProxy?: string;
  /*** Integer. Determines how much of the git repository’s history to retrieve ***/
  depth?: number | null;
  /*** The [working tree](dir-vs-gitdir.md) directory path ***/
  dir?: string;
  /*** A list of branches or tags. Instructs the remote server not to send us any commits reachable from these refs. ***/
  exclude?: string[];
  /*** a file system client ***/
  fs: FsClient;
  /*** [required] The [git directory](dir-vs-gitdir.md) path ***/
  gitdir?: string;
  /*** Additional headers to include in HTTP requests, similar to git’s `extraHeader` config ***/
  headers?: Record<string, string>;
  /*** an HTTP client ***/
  http: HttpClient;
  /*** A list of branches or tags to include. Instructs the remote server to send us commits reachable from these refs. ***/
  include?: string[];
  /*** optional auth fill callback ***/
  onAuth?: AuthCallback;
  /*** optional auth rejected callback ***/
  onAuthFailure?: AuthFailureCallback;
  /*** optional auth approved callback ***/
  onAuthSuccess?: AuthSuccessCallback;
  /*** optional message event callback ***/
  onMessage?: MessageCallback;
  /*** optional progress event callback ***/
  onProgress?: ProgressCallback;
  /*** Delete local remote-tracking branches that are not present on the remote ***/
  prune?: boolean;
  /*** Prune local tags that don’t exist on the remote, and force-update those tags that differ ***/
  pruneTags?: boolean;
  /*** Which branch to fetch if `singleBranch` is true. By default this is the current branch or the remote’s default branch. ***/
  ref?: string;
  /*** Changes the meaning of `depth` to be measured from the current shallow depth rather than from the branch tip. ***/
  relative?: boolean;
  /*** If URL is not specified, determines which remote to use. ***/
  remote?: string;
  /*** The name of the branch on the remote to fetch if `singleBranch` is true. By default this is the configured remote tracking branch. ***/
  remoteRef?: string;
  /*** Only fetch commits created after the given date. Mutually exclusive with `depth`. ***/
  since?: Date | null;
  /*** Instead of the default behavior of fetching all the branches, only fetch a single branch. ***/
  singleBranch?: boolean;
  /*** Also fetch tags ***/
  tags?: boolean;
  /*** The URL of the remote repository. The default is the value set in the git config for that remote. ***/
  url?: string;
}

/**
 * Fetch commits from a remote repository
 *
 * @param args - Options for the fetch operation
 * @returns Resolves successfully when fetch completes
 *
 * @example
 * let result = await git.fetch({
 *   corsProxy: "https://cors.eol.sh",
 *   depth: 1,
 *   dir: "/tutorial",
 *   fs,
 *   http,
 *   ref: "main",
 *   singleBranch: true,
 *   tags: false,
 *   url: "https://eol.sh/~eol/git"
 * });
 *
 * console.log(result);
 */
export async function fetch({
  cache = new Map(),
  corsProxy,
  depth = null,
  dir,
  exclude = [],
  fs: _fs,
  gitdir = join(dir!, ".git"),
  headers = {},
  http,
  include = [],
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  onMessage,
  onProgress,
  prune = false,
  pruneTags = false,
  ref,
  relative = false,
  remote,
  remoteRef,
  since = null,
  singleBranch = false,
  tags = false,
  url
}: FetchOptions): Promise<FetchResult> {
  try {
    assertParameter("fs", _fs);
    const fileSystem = adaptFileSystem(new FileSystem(_fs));

    assertParameter("http", http);
    assertParameter("gitdir", gitdir);

    const options: any = {
      cache,
      corsProxy,
      exclude,
      fs: fileSystem,
      gitdir,
      headers,
      http,
      include,
      prune,
      pruneTags,
      remote,
      since,
      tags,
      url
    };

    if (depth !== null && depth !== undefined)
      options.depth = depth;

    if (onAuth !== undefined)
      options.onAuth = onAuth;

    if (onAuthFailure !== undefined)
      options.onAuthFailure = onAuthFailure;

    if (onAuthSuccess !== undefined)
      options.onAuthSuccess = onAuthSuccess;

    if (onMessage !== undefined)
      options.onMessage = onMessage;

    if (onProgress !== undefined)
      options.onProgress = onProgress;

    if (ref !== undefined)
      options.ref = ref;

    if (relative !== undefined)
      options.relative = relative;

    if (remoteRef !== undefined)
      options.remoteRef = remoteRef;

    if (singleBranch !== undefined)
      options.singleBranch = singleBranch;

    return await _fetch(options);
  } catch(err: unknown) {
    (err as any).caller = "git.fetch";
    throw err;
  }
}

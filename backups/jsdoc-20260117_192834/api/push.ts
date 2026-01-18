


//// util

import { _push } from "../commands/push.ts";
import { adaptFsInterface } from "../utils/fs-adapter.ts";
import { assertParameter } from "../utils/assert-parameter.ts";
import { join } from "../utils/join.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  AuthSuccessCallback,
  Cache,
  FsClient,
  HttpClient,
  MessageCallback,
  PrePushCallback,
  ProgressCallback,
  PushResult
} from "../types.ts";



//// export

/**
 * Options for the push operation
 */
export interface PushOptions {
  /** a [cache](cache.md) object */
  cache?: Cache;
  /** Optional [CORS proxy](https://www.npmjs.com/%40isomorphic-git/cors-proxy). Overrides value in repo config. */
  corsProxy?: string;
  /** If true, delete the remote ref */
  delete?: boolean;
  /** The [working tree](dir-vs-gitdir.md) directory path */
  dir?: string;
  /** If true, behaves the same as `git push --force` */
  force?: boolean;
  /** a file system client */
  fs: FsClient;
  /** [required] The [git directory](dir-vs-gitdir.md) path */
  gitdir?: string;
  /** Additional headers to include in HTTP requests, similar to git’s `extraHeader` config */
  headers?: Record<string, string>;
  /** an HTTP client */
  http: HttpClient;
  /** optional auth fill callback */
  onAuth?: AuthCallback;
  /** optional auth rejected callback */
  onAuthFailure?: AuthFailureCallback;
  /** optional auth approved callback */
  onAuthSuccess?: AuthSuccessCallback;
  /** optional message event callback */
  onMessage?: MessageCallback;
  /** optional pre-push hook callback */
  onPrePush?: PrePushCallback;
  /** optional progress event callback */
  onProgress?: ProgressCallback;
  /** Which branch or tag to push. By default this is the currently checked out branch. */
  ref?: string;
  /** If URL is not specified, determines which remote to use. */
  remote?: string;
  /** The name of the receiving branch on the remote. By default this is the configured remote tracking branch. */
  remoteRef?: string;
  /** The URL of the remote repository. The default is the value set in the git config for that remote. */
  url?: string;
}

/**
 * Push a branch or tag
 *
 * The push command returns an object that describes the result of the attempted push operation.
 * *Notes:* If there were no errors, then there will be no `errors` property. There can be a mix of `ok` messages and `errors` messages.
 *
 * | param  | type [= default] | description                                                                                                                                                                                                      |
 * | ------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
 * | ok     | Array\<string\>  | The first item is "unpack" if the overall operation was successful. The remaining items are the names of refs that were updated successfully.                                                                    |
 * | errors | Array\<string\>  | If the overall operation threw and error, the first item will be "unpack {Overall error message}". The remaining items are individual refs that failed to be updated in the format "{ref name} {error message}". |
 *
 * @param args - Options for the push operation
 * @returns Resolves successfully when push completes with a detailed description of the operation from the server.
 *
 * @example
 * let pushResult = await git.push({
 *   dir: "/tutorial",
 *   fs,
 *   http,
 *   onAuth: () => ({ username: process.env.EOL_TOKEN }),
 *   ref: "main",
 *   remote: "origin"
 * });
 * console.log(pushResult);
 */
export async function push({
  cache = new Map(),
  corsProxy,
  delete: _delete = false,
  dir,
  force = false,
  fs,
  gitdir = join(dir!, ".git"),
  headers = {},
  http,
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  onMessage,
  onPrePush,
  onProgress,
  ref,
  remote = "origin",
  remoteRef,
  url
}: PushOptions): Promise<PushResult> {
  try {
    assertParameter("fs", fs);
    assertParameter("http", http);
    assertParameter("gitdir", gitdir);

    return await _push({
      cache,
      ...(corsProxy !== undefined ? { corsProxy } : {}),
      delete: _delete,
      force,
      fs: adaptFsInterface(fs),
      gitdir,
      headers,
      http,
      ...(onAuth !== undefined ? { onAuth } : {}),
      ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
      ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
      ...(onMessage !== undefined ? { onMessage } : {}),
      ...(onPrePush !== undefined ? { onPrePush } : {}),
      ...(onProgress !== undefined ? { onProgress } : {}),
      ...(ref !== undefined ? { ref } : {}),
      remote,
      ...(remoteRef !== undefined ? { remoteRef } : {}),
      ...(url !== undefined ? { url } : {})
    });
  } catch(err: unknown) {
    const error = err as Error;
    (error as any).caller = "git.push";
    throw error;
  }
}

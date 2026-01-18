


//// util

import "../typedefs.ts";

import { assertParameter } from "../utils/assert-parameter.ts";
import { formatInfoRefs } from "../utils/format-info-refs.ts";
import { GitRemoteManager } from "../managers/git-remote.ts";

import type { AuthCallback, AuthFailureCallback, AuthSuccessCallback, HttpClient } from "../types.ts";

interface GetRemoteInfo2Options {
  corsProxy?: string;
  forPush?: boolean;
  headers?: Record<string, string>;
  http: HttpClient;
  onAuth?: AuthCallback;
  onAuthFailure?: AuthFailureCallback;
  onAuthSuccess?: AuthSuccessCallback;
  protocolVersion?: 1 | 2;
  url: string;
}

interface GetRemoteInfo2Result {
  capabilities: Record<string, string | boolean>;
  protocolVersion: 1 | 2;
  refs?: Array<{ ref: string; oid: string; target?: string }>;
}



//// export

/**
 * @typedef {Object} GetRemoteInfo2Result - This object has the following schema:
 * @property {1 | 2} protocolVersion - Git protocol version the server supports
 * @property {Object<string, string | true>} capabilities - An object of capabilities represented as keys and values
 * @property {ServerRef[]} [refs] - Server refs (they get returned by protocol version 1 whether you want them or not)
 */

/**
 * List a remote server’s capabilities.
 *
 * This is a rare command that doesn’t require an `fs`, `dir`, or even `gitdir` argument.
 * It just communicates to a remote git server, determining what protocol version, commands, and features it supports.
 *
 * > The successor to [`getRemoteInfo`](./getRemoteInfo.md), this command supports Git Wire Protocol Version 2.
 * > Therefore its return type is more complicated as either:
 * >
 * > - v1 capabilities (and refs) or
 * > - v2 capabilities (and no refs)
 * >
 * > are returned.
 * > If you just care about refs, use [`listServerRefs`](./listServerRefs.md)
 *
 * @param {object} args
 * @param {HttpClient} args.http - an HTTP client
 * @param {AuthCallback} [args.onAuth] - optional auth fill callback
 * @param {AuthFailureCallback} [args.onAuthFailure] - optional auth rejected callback
 * @param {AuthSuccessCallback} [args.onAuthSuccess] - optional auth approved callback
 * @param {string} args.url - The URL of the remote repository. Will be gotten from gitconfig if absent.
 * @param {string} [args.corsProxy] - Optional [CORS proxy](https://www.npmjs.com/%40isomorphic-git/cors-proxy). Overrides value in repo config.
 * @param {boolean} [args.forPush = false] - By default, the command queries the "fetch" capabilities. If true, it will ask for the "push" capabilities.
 * @param {Object<string, string>} [args.headers] - Additional headers to include in HTTP requests, similar to git’s `extraHeader` config
 * @param {1 | 2} [args.protocolVersion = 2] - Which version of the Git Protocol to use.
 *
 * @returns {Promise<GetRemoteInfo2Result>} Resolves successfully with an object listing the capabilities of the remote.
 * @see GetRemoteInfo2Result
 * @see ServerRef
 *
 * @example
 * let info = await git.getRemoteInfo2({
 *   corsProxy: "https://cors.eol.sh",
 *   http,
 *   url: "https://eol.sh/~eol/git.git"
 * });
 *
 * console.log(info);
 */
export async function getRemoteInfo2({
  corsProxy,
  forPush = false,
  headers = {},
  http,
  onAuth,
  onAuthFailure,
  onAuthSuccess,
  protocolVersion = 2,
  url
}: GetRemoteInfo2Options): Promise<GetRemoteInfo2Result> {
  try {
    assertParameter("http", http);
    assertParameter("url", url);

    const GitRemoteHTTP = GitRemoteManager.getRemoteHelperFor({ url });

    const remote = await GitRemoteHTTP.discover({
      ...(corsProxy !== undefined ? { corsProxy } : {}),
      headers,
      http,
      ...(onAuth !== undefined ? { onAuth } : {}),
      ...(onAuthFailure !== undefined ? { onAuthFailure } : {}),
      ...(onAuthSuccess !== undefined ? { onAuthSuccess } : {}),
      protocolVersion: protocolVersion as 1 | 2,
      service: forPush ?
        "git-receive-pack" :
        "git-upload-pack",
      url
    });

    if ((remote as any).protocolVersion === 2) {
      /*** @type GetRemoteInfo2Result ***/
      return {
        capabilities: (remote as any).capabilities2 || {},
        protocolVersion: (remote as any).protocolVersion as 1 | 2
      };
    }

    /*** Note: remote.capabilities, remote.refs, and remote.symrefs are Set and Map objects,
    but one of the objectives of the public API is to always return JSON-compatible objects
    so we must JSONify them. ***/
    /*** @type Object<string, true> ***/
    const capabilities = {};

    for (const cap of remote.capabilities || []) {
      const [key, value] = cap.split("=");

      if (value)
        capabilities[key] = value;
      else
        capabilities[key] = true;
    }

    /*** @type GetRemoteInfo2Result ***/
    return {
      capabilities,
      protocolVersion: 1,
      refs: formatInfoRefs(remote as any, "", true, true)
    };
  } catch(err) {
    (err as any).caller = "git.getRemoteInfo2";
    throw err;
  }
}

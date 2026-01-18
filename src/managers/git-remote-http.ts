/**
 * @fileoverview git-remote-http manager
 *
 * Manages git-remote-http resources including creation, access, and lifecycle.
 * Provides centralized control and caching for git-remote-http operations.
 *
 * @module managers/git-remote-http.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// import

import { Buffer } from "node:buffer";

//// util

import "../typedefs.ts";

import { calculateBasicAuthHeader } from "../utils/calculate-basic-auth-header.ts";
import { collect } from "../utils/collect.ts";
import { extractAuthFromUrl } from "../utils/extract-auth-from-url.ts";
import { HttpError } from "../errors/http.ts";
import { parseRefsAdResponse } from "../wire/parse-refs-ad-response.ts";
import { SmartHttpError } from "../errors/smart-http.ts";
import { UserCanceledError } from "../errors/user-canceled.ts";

import type {
  AuthCallback,
  AuthFailureCallback,
  AuthResult,
  AuthSuccessCallback,
  GitHttpResponse,
  HttpClient,
  ProgressCallback
} from "../types.ts";

interface AuthInfo {
  headers?: Record<string, string>;
  password?: string;
  username?: string;
}

// Try to accommodate known CORS proxy implementations:
// - https://jcubic.pl/proxy.php?  <-- uses query string
// - https://cors.eol.sh  <-- uses path
const corsProxify = (corsProxy: string, url: string): string =>
  corsProxy.endsWith("?") ?
    `${corsProxy}${url}` :
    `${corsProxy}/${url.replace(/^https?:\/\//, "")}`;

/**
 * @param res - Git HTTP response
 * @returns Response body information
 */
const stringifyBody = async(res: GitHttpResponse): Promise<{ data?: Buffer; preview?: string; response?: string; }> => {
  try {
    /*** Some services provide a meaningful error message in the body of 403s like "token lacks the scopes necessary to perform this action" ***/
    const data = Buffer.from(await collect(res.body));
    const response = data.toString();
    const preview = response.length < 256 ? response : response.slice(0, 256) + "...";

    return { data, preview, response };
  } catch {
    return {};
  }
};

const updateHeaders = (headers: Record<string, string>, auth: AuthInfo): void => {
  /*** Update the basic auth header ***/
  if (auth.username || auth.password)
    headers.Authorization = calculateBasicAuthHeader(auth);

  /*** but any manually provided headers take precedence ***/
  if (auth.headers)
    Object.assign(headers, auth.headers);
};



//// export

export interface DiscoverResult {
  auth?: AuthInfo;
  capabilities?: string[];
  refs?: Map<string, string>;
  symrefs?: Map<string, string>;
}

export interface GitRemoteHTTPConnectOptions {
  auth: AuthInfo;
  body: any;
  corsProxy?: string;
  headers?: Record<string, string>;
  http: HttpClient;
  onProgress?: ProgressCallback;
  service: string;
  url: string;
}

export interface GitRemoteHTTPDiscoverOptions {
  corsProxy?: string;
  headers: Record<string, string>;
  http: HttpClient;
  onAuth?: AuthCallback;
  onAuthFailure?: AuthFailureCallback;
  onAuthSuccess?: AuthSuccessCallback;
  onProgress?: ProgressCallback;
  protocolVersion: 1 | 2;
  service: string;
  url: string;
}



export class GitRemoteHTTP {
  static capabilities(): Promise<string[]> {
    return Promise.resolve(["discover", "connect"]);
  }

  /**
   * Connect to remote repository for git operations
   */
  static async connect({
    auth,
    body,
    corsProxy,
    headers = {},
    http,
    onProgress,
    service,
    url
  }: GitRemoteHTTPConnectOptions): Promise<GitHttpResponse> {
    /*** We already have the "correct" auth value at this point, but
    we need to strip out the username/password from the URL yet again. ***/
    const urlAuth = extractAuthFromUrl(url);

    if (urlAuth)
      url = urlAuth.url;

    if (corsProxy)
      url = corsProxify(corsProxy, url);

    headers["content-type"] = `application/x-${service}-request`;
    headers.accept = `application/x-${service}-result`;

    updateHeaders(headers, auth);

    const res = await http.request({
      body,
      headers,
      method: "POST",
      ...(onProgress !== undefined ? { onProgress } : {}),
      url: `${url}/${service}`
    });

    if (res.statusCode !== 200) {
      const { response } = await stringifyBody(res);
      throw new HttpError(res.statusCode, res.statusMessage || "Unknown error", response || "No response");
    }

    return res;
  }

  /**
   * Discover remote repository capabilities and refs
   */
  static async discover({
    corsProxy,
    headers,
    http,
    onAuth,
    onAuthFailure,
    onAuthSuccess,
    onProgress,
    protocolVersion,
    service,
    url: _origUrl
  }: GitRemoteHTTPDiscoverOptions): Promise<DiscoverResult> {
    let { auth, url } = extractAuthFromUrl(_origUrl);

    const proxifiedURL = corsProxy ?
      corsProxify(corsProxy, url) :
      url;

    if (auth.username || auth.password)
      headers.Authorization = calculateBasicAuthHeader(auth);

    if (protocolVersion === 2)
      headers["Git-Protocol"] = "version=2";

    let providedAuthBefore = false;
    let res: GitHttpResponse;
    let tryAgain: boolean;

    do {
      res = await http.request({
        headers,
        method: "GET",
        ...(onProgress !== undefined ? { onProgress } : {}),
        url: `${proxifiedURL}/info/refs?service=${service}`
      });

      /*** the default loop behavior ***/
      tryAgain = false;

      /*** 401 is the "correct" response for access denied. 203 is Non-Authoritative Information and comes from Azure DevOps, which
      apparently doesn’t realize this is a git request and is returning the HTML for the "Azure DevOps Services | Sign In" page. ***/
      if (res.statusCode === 401 || res.statusCode === 203) {
        /*** On subsequent 401s, call `onAuthFailure` instead of `onAuth`.
        This is so that naive `onAuth` callbacks that return a fixed value don’t create an infinite loop of retrying. ***/
        const getAuth = providedAuthBefore ?
          onAuthFailure :
          onAuth;

        if (getAuth) {
          /*** Acquire credentials and try again
          Note: useHttpPath config reading disabled due to missing fs/gitdir context ***/
          const useHttpPath = false;

          const authResult = await getAuth(url, {
            ...auth,
            headers: { ...headers },
            useHttpPath
          });

          if (authResult && (authResult as AuthResult).cancel) {
            throw new UserCanceledError();
          } else if (authResult) {
            auth = authResult as AuthInfo;
            updateHeaders(headers, auth);
            providedAuthBefore = true;
            tryAgain = true;
          }
        }
      } else if (res.statusCode === 200 && providedAuthBefore && onAuthSuccess) {
        await onAuthSuccess(url, auth);
      }
    } while (tryAgain);

    if (res.statusCode !== 200) {
      const { response } = await stringifyBody(res);
      throw new HttpError(res.statusCode, res.statusMessage || "Unknown error", response || "No response");
    }

    /*** Git "smart" HTTP servers should respond with the correct Content-Type header. ***/
    if (res.headers["content-type"] === `application/x-${service}-advertisement`) {
      const remoteHTTP = await parseRefsAdResponse(res.body, { service });
      (remoteHTTP as any).auth = auth;

      return remoteHTTP as any;
    } else {
      /*** If they don’t send the correct content-type header, that’s a good indicator it is either a "dumb" HTTP
      server, or the user specified an incorrect remote URL and the response is actually an HTML page.
      In this case, we save the response as plain text so we can generate a better error message if needed. ***/
      const { preview, response, data } = await stringifyBody(res);
      /*** For backwards compatibility with servers that don’t send correct content-type,
      attempt to parse the response anyway. This helps with older or misconfigured servers. ***/
      try {
        const remoteHTTP = await parseRefsAdResponse([data!], { service });
        (remoteHTTP as any).auth = auth;

        return remoteHTTP as any;
      } catch {
        /*** If parsing fails, throw a descriptive error with the response preview ***/
        throw new SmartHttpError(preview!, response!);
      }
    }
  }
}

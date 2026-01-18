


//// util

import { GitRemoteHTTP } from "./git-remote-http.ts";
import { UnknownTransportError } from "../errors/unknown-transport.ts";
import { UrlParseError } from "../errors/url-parse.ts";

interface RemoteUrlParts {
  address: string;
  transport: string;
}

/*** Registry for remote helpers by protocol ***/
const REMOTE_HELPERS = new Map<string, typeof GitRemoteHTTP>([
  ["http", GitRemoteHTTP],
  ["https", GitRemoteHTTP]
  // Future protocols can be registered here
  // ["git", GitRemoteNative],
  // ["ssh", GitRemoteSSH],
]);



//// export

export class GitRemoteManager {
  /**
   * Get the appropriate remote helper for a given URL
   */
  static getRemoteHelperFor({ url }: { url: string }): typeof GitRemoteHTTP {
    const parts = parseRemoteUrl({ url });

    if (!parts)
      throw new UrlParseError(url);

    if (REMOTE_HELPERS.has(parts.transport))
      return REMOTE_HELPERS.get(parts.transport)!;

    throw new UnknownTransportError(url, parts.transport);
  }

  /**
   * Register a remote helper for a specific protocol
   */
  static registerRemoteHelper(protocol: string, helper: typeof GitRemoteHTTP): void {
    REMOTE_HELPERS.set(protocol, helper);
  }
}



//// helper

function parseRemoteUrl({ url }: { url: string }): RemoteUrlParts | undefined {
  /*** the stupid "shorter scp-like syntax" ***/
  if (url.startsWith("git@")) {
    return {
      address: url,
      transport: "ssh"
    };
  }

  const matches = url.match(/(\w+)(:\/\/|::)(.*)/);

  if (matches === null)
    return;

  /*
   * When git encounters a URL of the form <transport>://<address>, where <transport> is
   * a protocol that it cannot handle natively, it automatically invokes git remote-<transport>
   * with the full URL as the second argument.
   *
   * @see https://git-scm.com/docs/git-remote-helpers
   */
  if (matches[2] === "://") {
    return {
      address: matches[0],
      transport: matches[1]
    };
  }

  /*
   * A URL of the form <transport>::<address> explicitly instructs git to invoke
   * git remote-<transport> with <address> as the second argument.
   *
   * @see https://git-scm.com/docs/git-remote-helpers
   */
  if (matches[2] === "::") {
    return {
      address: matches[3],
      transport: matches[1]
    };
  }

  return undefined;
}

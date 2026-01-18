/**
 * @fileoverview translate-ssh-to-http utility functions
 *
 * Utility functions for translate-ssh-to-http operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/translate-ssh-to-http.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// export

export function translateSSHtoHTTP(url: string): string {
  /*** handle "shorter scp-like syntax" ***/
  url = url.replace(/^git@([^:]+):/, "https://$1/");

  /*** handle proper SSH URLs ***/
  url = url.replace(/^ssh:\/\//, "https://");

  return url;
}

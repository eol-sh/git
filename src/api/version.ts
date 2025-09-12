


//// util

import { pkg } from "../utils/pkg.ts";



//// export

/**
 * Return the version number of @eol/git
 *
 * I don’t know why you might need this. I added it just so I could check that I was getting
 * the correct version of the library and not a cached version.
 *
 * @returns the version string taken from package.json at publication time
 *
 * @example
 * console.log(git.version());
 */
export function version(): string {
  try {
    return pkg.version;
  } catch(err: unknown) {
    (err as any).caller = "git.version";
    throw err;
  }
}

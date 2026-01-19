/**
 * @fileoverview clean-git-ref utility functions
 *
 * Utility functions for clean-git-ref operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/clean-git-ref.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

/*** EXPORT ------------------------------------------- ***/

export const CleanGitRef = {
  clean(value: unknown) {
    if (typeof value !== "string")
      throw new Error("Expected a string, received: " + value);

    value = replaceAll(value, "./", "/");
    value = replaceAll(value, "..", ".");
    value = replaceAll(value, " ", "-");
    value = replaceAll(value, /^[~^:?*\\\-]/g, "");
    value = replaceAll(value, /[~^:?*\\]/g, "-");
    value = replaceAll(value, /[~^:?*\\\-]$/g, "");
    value = replaceAll(value, "@{", "-");
    value = replaceAll(value, /\.$/g, "");
    value = replaceAll(value, /\/$/g, "");
    value = replaceAll(value, /\.lock$/g, "");

    return value;
  },
};

export default CleanGitRef;

/*** HELPER ------------------------------------------- ***/

function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); /*** $& means the whole matched string ***/
}

function replaceAll(str: string | unknown, search: RegExp | string, replacement: string) {
  search = search instanceof RegExp ?
    search :
    new RegExp(escapeRegExp(search), "g");

  return String(str).replace(search, replacement);
}



/*** via https://github.com/elicwhite/clean-git-ref ***/

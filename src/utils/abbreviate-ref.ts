/**
 * @fileoverview abbreviate-ref utility functions
 *
 * Utility functions for abbreviate-ref operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/abbreviate-ref.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */

/*** UTILITY ------------------------------------------ ***/

const abbreviateRx = new RegExp("^refs/(heads/|tags/|remotes/)?(.*)");

/*** EXPORT ------------------------------------------- ***/

export function abbreviateRef(ref: string): string {
  const match = abbreviateRx.exec(ref);

  if (match) {
    if (match[1] === "remotes/" && ref.endsWith("/HEAD"))
      return match[2].slice(0, -5);
    else
      return match[2];
  }

  return ref;
}



/*** @see https://git-scm.com/docs/git-rev-parse.html#_specifying_revisions ***/

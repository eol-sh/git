/**
 * @fileoverview modified utility functions
 *
 * Utility functions for modified operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/modified.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// util

import type { WalkerEntry } from "../types.ts";



//// export

export async function modified(entry: WalkerEntry | null | undefined, base: WalkerEntry | null | undefined): Promise<boolean> {
  if (!entry && !base)
    return false;

  if (entry && !base)
    return true;

  if (!entry && base)
    return true;

  /*** Both entries exist ***/
  if (!entry || !base)
    return true; /*** This shouldn’t happen but satisfies TypeScript ***/

  if ((await entry.type()) === "tree" && (await base.type()) === "tree")
    return false;

  if (
    (await entry.type()) === (await base.type()) &&
    (await entry.mode()) === (await base.mode()) &&
    (await entry.oid()) === (await base.oid())
  ) return false;

  return true;
}

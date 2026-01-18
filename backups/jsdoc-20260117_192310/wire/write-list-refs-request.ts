


//// util

import { GitPktLine } from "../models/git-pkt-line.ts";
import { pkg } from "../utils/pkg.ts";

interface WriteListRefsRequestOptions {
  peelTags?: boolean;
  prefix?: string;
  symrefs?: boolean;
}



//// export

/**
 * @param {object} args
 * @param {string} [args.prefix] - Only list refs that start with this prefix
 * @param {boolean} [args.symrefs = false] - Include symbolic ref targets
 * @param {boolean} [args.peelTags = false] - Include peeled tags values
 * @returns {Uint8Array[]}
 */
export function writeListRefsRequest({ peelTags, prefix, symrefs }: WriteListRefsRequestOptions): Uint8Array[] {
  const packstream: Uint8Array[] = [];

  packstream.push(GitPktLine.encode("command=ls-refs\n"));    /*** command ***/
  packstream.push(GitPktLine.encode(`agent=${pkg.agent}\n`)); /*** capability-list ***/

  if (peelTags || symrefs || prefix) /*** [command-args] ***/
    packstream.push(GitPktLine.delim());

  if (peelTags)
    packstream.push(GitPktLine.encode("peel"));

  if (symrefs)
    packstream.push(GitPktLine.encode("symrefs"));

  if (prefix)
    packstream.push(GitPktLine.encode(`ref-prefix ${prefix}`));

  packstream.push(GitPktLine.flush());
  return packstream;
}

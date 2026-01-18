/**
 * @fileoverview write-refs-ad-response wire protocol implementation
 *
 * Handles write-refs-ad-response wire protocol operations for Git network
 * communication including parsing and serialization.
 *
 * @module wire/write-refs-ad-response.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */


//// util

import { GitPktLine } from "../models/git-pkt-line.ts";
import { pkg } from "../utils/pkg.ts";



//// export

export function writeRefsAdResponse({ capabilities, refs, symrefs }) {
  const stream = [];
  let syms = ""; /*** Compose capabilities string ***/

  for (const [key, value] of Object.entries(symrefs)) {
    syms += `symref=${key}:${value} `;
  }

  let caps = `\x00${[...capabilities].join(" ")} ${syms}agent=${pkg.agent}`;

  // stream.write(GitPktLine.encode(`# service=${service}\n`))
  // stream.write(GitPktLine.flush())

  /*** Note: In the edge case of a brand new repo, zero refs (and zero capabilities) are returned. ***/
  for (const [key, value] of Object.entries(refs)) {
    stream.push(GitPktLine.encode(`${value} ${key}${caps}\n`));
    caps = "";
  }

  stream.push(GitPktLine.flush());
  return stream;
}

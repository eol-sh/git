


//// util

import { GitPktLine } from "../models/git-pkt-line.ts";



//// export

/**
 * @typedef {Object} ServerRef - This object has the following schema:
 * @property {string} ref - The name of the ref
 * @property {string} oid - The SHA-1 object id the ref points to
 * @property {string} [target] - The target ref pointed to by a symbolic ref
 * @property {string} [peeled] - If the oid is the SHA-1 object id of an annotated tag, this is the SHA-1 object id that the annotated tag points to
 */

/**
 * Memory-efficient generator version that yields refs one at a time
 */
export async function* parseListRefsResponseGenerator(stream: any) {
  const read = GitPktLine.streamReader(stream);
  let line;

  while (true) {
    line = await read();

    if (line === true)
      break;

    if (line === null)
      continue;

    line = line.toString().replace(/\n$/, "");

    const [oid, ref, ...attrs] = line.split(" ");
    const r: any = { oid, ref };

    for (const attr of attrs) {
      const [name, value] = attr.split(":");

      if (name === "symref-target")
        r.target = value;
      else if (name === "peeled")
        r.peeled = value;
    }

    yield r; /*** Yield one ref at a time instead of accumulating ***/
  }
}

/**
 * Original function that collects all refs into an array
 * Kept for backward compatibility
 */
export async function parseListRefsResponse(stream: any) {
  const refs: any[] = [];

  for await (const ref of parseListRefsResponseGenerator(stream)) {
    refs.push(ref);
  }

  return refs;
}

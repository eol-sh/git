/**
 * @fileoverview parse-refs-ad-response wire protocol implementation
 *
 * Handles parse-refs-ad-response wire protocol operations for Git network
 * communication including parsing and serialization.
 *
 * @module wire/parse-refs-ad-response.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 * @internal
 */

/*** UTILITY ------------------------------------------ ***/

import { EmptyServerResponseError } from "../errors/empty-server-response.ts";
import { GitPktLine } from "../models/git-pkt-line.ts";
import { parseCapabilitiesV2 } from "../wire/parse-capabilities-v2.ts";
import { ParseError } from "../errors/parse.ts";

/*** EXPORT ------------------------------------------- ***/

export async function parseRefsAdResponse(stream: any, { service }: any) {
  const capabilities = new Set();
  const refs = new Map();
  const symrefs = new Map();

  /*** There is probably a better way to do this, but for now
       let’s just throw the result parser inline here. ***/
  const read = GitPktLine.streamReader(stream);
  let lineOne = await read();

  /*** skip past any flushes ***/
  while (lineOne === null)
    lineOne = await read();

  if (lineOne === true)
    throw new EmptyServerResponseError();

  /*** Handle protocol v2 responses (Bitbucket Server doesn’t include a `# service=` line) ***/
  if ((lineOne as any).includes("version 2"))
    return parseCapabilitiesV2(read);

  /*** Clients MUST ignore an LF at the end of the line. ***/
  if (lineOne.toString().replace(/\n$/, "") !== `# service=${service}`)
    throw new ParseError(`# service=${service}\\n`, lineOne.toString());

  let lineTwo = await read();

  /*** skip past any flushes ***/
  while (lineTwo === null)
    lineTwo = await read();

  /*** In the edge case of a brand new repo, zero refs (and zero capabilities)
  are returned. ***/
  if (lineTwo === true)
    return { capabilities, refs, symrefs };

  lineTwo = (lineTwo as any).toString();

  /*** Handle protocol v2 responses ***/
  if ((lineTwo as any).includes && (lineTwo as any).includes("version 2"))
    return parseCapabilitiesV2(read);

  const [firstRef, capabilitiesLine] = splitAndAssert(lineTwo, "\x00", "\\x00");
  capabilitiesLine.split(" ").map((x) => capabilities.add(x));

  /*** see no-refs in https://git-scm.com/docs/pack-protocol#_reference_discovery (since git 2.41.0) ***/
  if (firstRef !== "0000000000000000000000000000000000000000 capabilities^{}") {
    const [ref, name] = splitAndAssert(firstRef, " ", " ");
    refs.set(name, ref);

    while (true) {
      const line = await read();

      if (line === true)
        break;

      if (line !== null) {
        const [ref, name] = splitAndAssert(line.toString(), " ", " ");
        refs.set(name, ref);
      }
    }
  }

  /*** Symrefs are thrown into the "capabilities" unfortunately. ***/
  for (const cap of capabilities) {
    if ((cap as string).startsWith("symref=")) {
      const m = (cap as string).match(/symref=([^:]+):(.*)/);

      if (m && m.length === 3)
        symrefs.set(m[1], m[2]);
    }
  }

  return { capabilities, protocolVersion: 1, refs, symrefs };
}

/*** HELPER ------------------------------------------- ***/

function splitAndAssert(line: any, sep: any, expected: any) {
  const split = line.trim().split(sep);

  if (split.length !== 2)
    throw new ParseError(`Two strings separated by "${expected}"`, line.toString());

  return split;
}

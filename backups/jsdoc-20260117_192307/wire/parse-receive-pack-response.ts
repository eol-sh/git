


//// util

import "../typedefs.ts";

import { GitPktLine } from "../models/git-pkt-line.ts";
import { ParseError } from "../errors/parse.ts";



//// export

export async function parseReceivePackResponse(packfile: any) {
  const read = GitPktLine.streamReader(packfile);
  const result: any = {};
  let line = await read();
  let response = "";

  while (line !== true) {
    if (line !== null)
      response += line.toString() + "\n";

    line = await read();
  }

  const lines = response.toString().split("\n");
  /*** We’re expecting "unpack {unpack-result}" ***/
  line = lines.shift() as any;

  if (!line || !(line as unknown as string).startsWith("unpack "))
    throw new ParseError(`unpack ok" or "unpack [error message]`, line as unknown as string);

  result.ok = (line as unknown as string) === "unpack ok";

  if (!result.ok)
    result.error = (line as unknown as string).slice("unpack ".length);

  result.refs = {};

  for (const line of lines) {
    if (line.trim() === "")
      continue;

    const status = line.slice(0, 2);
    const refAndMessage = line.slice(3);
    let space = refAndMessage.indexOf(" ");

    if (space === -1)
      space = refAndMessage.length;

    const ref = refAndMessage.slice(0, space);
    const error = refAndMessage.slice(space + 1);

    result.refs[ref] = {
      error,
      ok: status === "ok"
    };
  }

  return result;
}

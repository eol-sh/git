


//// util

import { GitPktLine } from "../models/git-pkt-line.ts";



//// export

export async function parseUploadPackRequest(stream) {
  const exclude = [];
  const haves = [];
  const read = GitPktLine.streamReader(stream);
  const shallows = [];
  const wants = [];
  let capabilities = null;
  let depth;
  let done = false;
  let relative = false;
  let since;

  while (!done) {
    const line = await read();

    if (line === true)
      break;

    if (line === null)
      continue;

    const [key, value, ...rest] = line
      .toString()
      .trim()
      .split(" ");

    if (!capabilities)
      capabilities = rest;

    switch(key) {
      case "want": {
        wants.push(value);
        break;
      }

      case "have": {
        haves.push(value);
        break;
      }

      case "shallow": {
        shallows.push(value);
        break;
      }

      case "deepen": {
        depth = parseInt(value);
        break;
      }

      case "deepen-since": {
        since = parseInt(value);
        break;
      }

      case "deepen-not": {
        exclude.push(value);
        break;
      }

      case "deepen-relative": {
        relative = true;
        break;
      }

      case "done": {
        done = true;
        break;
      }
    }
  }

  return {
    capabilities,
    depth,
    done,
    exclude,
    haves,
    relative,
    shallows,
    since,
    wants
  };
}

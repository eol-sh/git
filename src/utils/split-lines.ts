/**
 * @fileoverview split-lines utility functions
 *
 * Utility functions for split-lines operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/split-lines.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 */


//// import

import { Buffer } from "node:buffer";

//// util

import { FIFO } from "./fifo.ts";



//// export

export function splitLines(input: AsyncIterable<Buffer | string>): FIFO<string> {
  const output = new FIFO<string>();
  let tmp = "";

  (async() => {
    for await (let chunk of input) {
      chunk = chunk.toString();
      tmp += chunk;

      while (true) {
        const i = findSplit(tmp);

        if (i === -1)
          break;

        output.write(tmp.slice(0, i));
        tmp = tmp.slice(i);
      }
    }

    if (tmp.length > 0)
      output.write(tmp);

    output.end();
  })();

  return output;
}



//// helper

// Note: progress messages are designed to be written directly to the terminal,
// so they are often sent with just a carriage return to overwrite the last line of output.
// But there are also messages delimited with newlines.
// I also include CRLF just in case.
function findSplit(str: string): number {
  const r = str.indexOf("\r");
  const n = str.indexOf("\n");

  if (r === -1 && n === -1)
    return -1;

  if (r === -1)
    return n + 1; /*** \n ***/

  if (n === -1)
    return r + 1; /*** \r ***/

  if (n === r + 1)
    return n + 1; /*** \r\n ***/

  return Math.min(r, n) + 1; /*** \r or \n ***/
}

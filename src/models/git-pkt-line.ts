/**
 * @fileoverview git-pkt-line model definition
 *
 * Defines the git-pkt-line class and related types for representing
 * Git objects and data structures in the implementation.
 *
 * @module models/git-pkt-line.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//**
pkt-line Format
---------------

Much (but not all) of the payload is described around pkt-lines.

A pkt-line is a variable length binary string.  The first four bytes
of the line, the pkt-len, indicates the total length of the line,
in hexadecimal.  The pkt-len includes the 4 bytes used to contain
the length’s hexadecimal representation.

A pkt-line MAY contain binary data, so implementers MUST ensure
pkt-line parsing/formatting routines are 8-bit clean.

A non-binary line SHOULD BE terminated by an LF, which if present
MUST be included in the total length. Receivers MUST treat pkt-lines
with non-binary data the same whether or not they contain the trailing
LF (stripping the LF if present, and not complaining when it is
missing).

The maximum length of a pkt-line’s data component is 65516 bytes.
Implementations MUST NOT send pkt-line whose length exceeds 65520
(65516 bytes of payload + 4 bytes of length data).

Implementations SHOULD NOT send an empty pkt-line ("0004").

A pkt-line with a length field of 0 ("0000"), called a flush-pkt,
is a special case and MUST be handled differently than an empty
pkt-line ("0004").

----
  pkt-line     =  data-pkt / flush-pkt

  data-pkt     =  pkt-len pkt-payload
  pkt-len      =  4*(HEXDIG)
  pkt-payload  =  (pkt-len - 4)*(OCTET)

  flush-pkt    = "0000"
----

Examples (as C-style strings):

----
  pkt-line          actual value
  ---------------------------------
  "0006a\n"         "a\n"
  "0005a"           "a"
  "000bfoobar\n"    "foobar\n"
  "0004"            ""
----
*/



//// util

import { padHex } from "../utils/pad-hex.ts";
import { StreamReader } from "../utils/stream-reader.ts";

interface StreamLike {
  error?: Error;
}



//// export

/*** I’m really using this more as a namespace.
There’s not a lot of "state" in a pkt-line ***/

export class GitPktLine {
  static delim(): Uint8Array {
    return new TextEncoder().encode("0001");
  }

  static encode(line: string | Uint8Array): Uint8Array {
    let lineBytes: Uint8Array;

    if (typeof line === "string")
      lineBytes = new TextEncoder().encode(line);
    else
      lineBytes = line;

    const length = lineBytes.length + 4;
    const hexlength = padHex(4, length);
    const hexBytes = new TextEncoder().encode(hexlength);
    const result = new Uint8Array(hexBytes.length + lineBytes.length);

    result.set(hexBytes);
    result.set(lineBytes, hexBytes.length);
    return result;
  }

  static flush(): Uint8Array {
    return new TextEncoder().encode("0000");
  }

  static streamReader(stream: StreamLike): () => Promise<Uint8Array | null | true> {
    const reader = new StreamReader(stream as any);

    return async function read(): Promise<Uint8Array | null | true> {
      try {
        const length = await reader.read(4);

        if (length === null)
          return true;

        const lengthStr = new TextDecoder().decode(length);
        const lengthNum = parseInt(lengthStr, 16);

        if (lengthNum === 0)
          return null;

        if (lengthNum === 1)
          return null; /*** delim packets ***/

        const buffer = await reader.read(lengthNum - 4);

        if (buffer === null)
          return true;

        return buffer || null;
      } catch(err) {
        stream.error = err as Error;
        return true;
      }
    };
  }
}

/**
 * @fileoverview deflate utility functions
 *
 * Utility functions for deflate operations used throughout
 * the Git implementation for common tasks and transformations.
 *
 * @module utils/deflate.ts
 * @version 1.0.0
 * @author EOL Git Implementation
 * @since 1.0.0
 *//* global CompressionStream */



//// util

import pako from "../compat/pako.ts";

let supportsCompressionStream: boolean | null = null;



//// export

export function deflate(buffer: Uint8Array): Promise<Uint8Array> {
  if (supportsCompressionStream === null)
    supportsCompressionStream = testCompressionStream();

  return supportsCompressionStream ?
    browserDeflate(buffer) :
    pako.deflate(buffer);
}



//// helper

async function browserDeflate(buffer: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("deflate");
  const c = new Blob([new Uint8Array(buffer)]).stream().pipeThrough(cs);

  return new Uint8Array(await new Response(c).arrayBuffer());
}

function testCompressionStream(): boolean {
  try {
    const cs = new CompressionStream("deflate");
    cs.writable.close();
    /*** Test if `Blob.stream` is present. React Native does not have the `stream` method ***/
    const stream = new Blob([]).stream();
    stream.cancel();

    return true;
  } catch {
    return false;
  }
}
